import { Platform } from "react-native";
import { extractCardPayload, normalizeUid, type NfcByteRecord } from "../utils/cbcNfc";

export type NfcCardRead = {
  uid: string;
  payload: string;
};

export type NfcReadErrorCode = "unsupported" | "disabled" | "aborted" | "not_cbc" | "read_error";

export class NfcReadError extends Error {
  code: NfcReadErrorCode;

  constructor(code: NfcReadErrorCode, message: string) {
    super(message);
    this.name = "NfcReadError";
    this.code = code;
  }
}

type NfcTag = {
  id?: string;
  ndefMessage?: NfcByteRecord[] | null;
};

type NfcErrorCtor = new (...args: unknown[]) => Error;

type NfcModule = {
  default: {
    start: () => Promise<void>;
    isSupported: () => Promise<boolean>;
    isEnabled: () => Promise<boolean>;
    requestTechnology: (tech: string | string[], options?: Record<string, unknown>) => Promise<void>;
    getTag: () => Promise<NfcTag | null>;
    cancelTechnologyRequest: () => Promise<void>;
  };
  NfcTech: Record<string, string>;
  NfcAdapter?: Record<string, number>;
  NfcError: {
    UserCancel: NfcErrorCtor;
    Timeout: NfcErrorCtor;
    SecurityViolation: NfcErrorCtor;
    UnsupportedFeature: NfcErrorCtor;
    SystemBusy: NfcErrorCtor;
    RadioDisabled: NfcErrorCtor;
  };
};

const IOS_HOLD = "Hold your CBC card against the top of your iPhone.";
const ANDROID_HOLD = "Hold your CBC card against the back of your phone.";

function cancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /cancel/i.test(message);
}

function explainNfcFailure(error: unknown, nfc: NfcModule): NfcReadError {
  if (error instanceof NfcReadError) return error;
  const { UserCancel, Timeout, SecurityViolation, UnsupportedFeature, SystemBusy, RadioDisabled } = nfc.NfcError;
  if (error instanceof UserCancel || cancelled(error)) {
    return new NfcReadError("aborted", "Cancelled.");
  }
  if (error instanceof Timeout) {
    return new NfcReadError(
      "read_error",
      Platform.OS === "ios"
        ? `The reader timed out. ${IOS_HOLD}`
        : `The reader timed out. ${ANDROID_HOLD}`
    );
  }
  if (error instanceof SecurityViolation || error instanceof UnsupportedFeature) {
    return new NfcReadError(
      "unsupported",
      "This install cannot read NFC cards. Update the JosCity app, then try the tap again."
    );
  }
  if (error instanceof SystemBusy) {
    return new NfcReadError("read_error", "The card reader is busy. Wait a moment, then tap your CBC card again.");
  }
  if (error instanceof RadioDisabled) {
    return new NfcReadError("disabled", "Turn NFC on in your phone settings, then tap your card again.");
  }
  return new NfcReadError(
    "read_error",
    Platform.OS === "ios"
      ? `Could not read the card. ${IOS_HOLD}`
      : `Could not read the card. ${ANDROID_HOLD}`
  );
}

let prepared: Promise<NfcModule | null> | null = null;
let readyNfc: NfcModule | null = null;
let prepareError: NfcReadError | null = null;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Android `isSupported` asks the current Activity. That Activity is often
 * missing on the first paint, and the library reports it as a failure.
 * A missing Activity is not the same as a phone without NFC.
 */
async function androidCanReadNfc(nfc: NfcModule): Promise<"yes" | "no" | "off" | "not_ready"> {
  let waitingForActivity = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      if (await nfc.default.isSupported()) {
        const enabled = await nfc.default.isEnabled();
        return enabled ? "yes" : "off";
      }
      const enabled = await nfc.default.isEnabled().catch(() => false);
      if (enabled) return "yes";
      return "no";
    } catch (error) {
      const message = errorText(error);
      if (/no nfc support/i.test(message)) return "no";
      if (/current activity/i.test(message)) {
        waitingForActivity = true;
        await delay(200);
        continue;
      }
      throw error;
    }
  }
  return waitingForActivity ? "not_ready" : "no";
}

async function loadReader(): Promise<NfcModule> {
  const nfc = (await import("react-native-nfc-manager")) as unknown as NfcModule;
  if (Platform.OS === "android") {
    const status = await androidCanReadNfc(nfc);
    if (status === "no") throw new NfcReadError("unsupported", "Tap to pay needs a phone with NFC.");
    if (status === "off") {
      throw new NfcReadError("disabled", "Turn NFC on in your phone settings, then tap your card again.");
    }
    if (status === "not_ready") {
      throw new NfcReadError("read_error", "The card reader is not ready yet. Tap to pay again.");
    }
  } else {
    const supported = await nfc.default.isSupported();
    if (!supported) throw new NfcReadError("unsupported", "Tap to pay needs a phone with NFC.");
  }
  await startReader(nfc);
  return nfc;
}

async function startReader(nfc: NfcModule): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await nfc.default.start();
      return;
    } catch (error) {
      const message = errorText(error);
      if (/no nfc support/i.test(message)) {
        throw new NfcReadError("unsupported", "Tap to pay needs a phone with NFC.");
      }
      if (/current activity/i.test(message) && attempt < 5) {
        await delay(200);
        continue;
      }
      throw error;
    }
  }
}

/** Load the reader before the button press so the scan can start on the tap. */
export function prepareCardReader(): void {
  if (Platform.OS === "web" || prepared) return;
  prepareError = null;
  prepared = loadReader()
    .then((nfc) => {
      readyNfc = nfc;
      prepareError = null;
      return nfc;
    })
    .catch((error) => {
      readyNfc = null;
      prepared = null;
      const message = errorText(error);
      prepareError =
        error instanceof NfcReadError
          ? error
          : new NfcReadError(
              /current activity/i.test(message) ? "read_error" : "unsupported",
              /no such native method|NfcManager/i.test(message)
                ? "This Android install cannot read NFC cards. Update the JosCity app, then try the tap again."
                : /current activity/i.test(message)
                  ? "The card reader is not ready yet. Tap to pay again."
                  : "Tap to pay needs a phone with NFC."
            );
      return null;
    });
}

/**
 * Foreground-only read of a CBC card. The phone never decrypts the tag: it
 * returns the UID and the RGC1 ciphertext for the server. This is not Apple
 * Tap to Pay and does not emulate a payment card.
 */
export async function readCardTap(signal: AbortSignal): Promise<NfcCardRead> {
  if (signal.aborted) throw new NfcReadError("aborted", "Cancelled.");
  if (Platform.OS === "web") {
    throw new NfcReadError("unsupported", "Tap to pay needs a phone with NFC.");
  }

  prepareCardReader();
  let nfc = readyNfc;
  if (!nfc) {
    const pending = prepared;
    nfc = pending ? await pending : null;
    if (!nfc) {
      const failure =
        prepareError ?? new NfcReadError("unsupported", "Tap to pay needs a phone with NFC.");
      prepareError = null;
      throw failure;
    }
  }

  const manager = nfc.default;
  const onAbort = () => {
    void manager.cancelTechnologyRequest().catch(() => undefined);
  };
  signal.addEventListener("abort", onAbort);

  try {
    const tech =
      Platform.OS === "ios"
        ? nfc.NfcTech.MifareIOS
        : [nfc.NfcTech.Ndef, nfc.NfcTech.NfcA, nfc.NfcTech.MifareUltralight];
    const readerFlags = nfc.NfcAdapter?.FLAG_READER_NFC_A ?? 0x1;
    await manager.requestTechnology(tech, {
      alertMessage: IOS_HOLD,
      invalidateAfterFirstRead: true,
      isReaderModeEnabled: Platform.OS === "android",
      readerModeFlags: Platform.OS === "android" ? readerFlags : 0,
      readerModeDelay: 250,
    });
    if (signal.aborted) throw new NfcReadError("aborted", "Cancelled.");
    const tag = await manager.getTag();
    const uid = normalizeUid(tag?.id);
    const payload = extractCardPayload(tag?.ndefMessage);
    if (!uid || !payload) {
      throw new NfcReadError("not_cbc", "That is not a CBC card. Tap your CBC card and try again.");
    }
    return { uid, payload };
  } catch (error) {
    if (signal.aborted) throw new NfcReadError("aborted", "Cancelled.");
    throw explainNfcFailure(error, nfc);
  } finally {
    signal.removeEventListener("abort", onAbort);
    await manager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export function nfcHoldHint(): string {
  return Platform.OS === "ios" ? IOS_HOLD : ANDROID_HOLD;
}
