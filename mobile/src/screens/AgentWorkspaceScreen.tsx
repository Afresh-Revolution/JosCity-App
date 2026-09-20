import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import FeedShell, { TAB_BAR_SPACE } from "../components/feed/FeedShell";
import AppButton from "../components/AppButton";
import JosCityLoader from "../components/JosCityLoader";
import { getAuthToken } from "../storage/session";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/colors";
import { Editor, useAgentWorkspace } from "../state/useAgentWorkspace";
import { agentApi, UploadImage, type Job } from "../api/agent";
import AgentJobCard from "../components/agents/AgentJobCard";
import AgentRatingSheet from "../components/agents/AgentRatingSheet";
import AgentVendorPaySheet from "../components/agents/AgentVendorPaySheet";
import { openMemberProfile } from "../utils/openProfile";
import { formatMoneyInput, parseMoneyInput } from "../utils/format";

const TAB_LABELS: Record<string, string> = {
  directory: "Directory",
  requests: "Requests",
  jobs: "Jobs",
  catalogue: "Catalogue",
  dashboard: "Dashboard",
  profile: "Profile",
  wallet: "Wallet",
  referrals: "Referrals",
};

function EditForm({ editor, busy, error, close, save }: { editor: Editor; busy: boolean; error: string; close: () => void; save: (values: Record<string,string>, images: UploadImage[]) => void }) {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeFormStyles(c), [c]);
  const isRequest = editor.title === "Help me buy" || editor.title === "Help me deliver";
  const fields = editor.fields.filter((f) => !/(^|[A-Z])(Lat|Lng)$/.test(f.key));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value || (f.required ? f.options?.[0]?.value : "") || ""]))
  );
  const [images, setImages] = useState<UploadImage[]>([]);
  const [validation, setValidation] = useState("");

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, (editor.imageLimit || 1) - images.length),
        quality: 0.8,
      });
      if (!result.canceled) {
        setImages((prev) =>
          [
            ...prev,
            ...result.assets.map((a) => ({
              uri: a.uri,
              name: a.fileName || `photo-${prev.length + 1}.jpg`,
              type: a.mimeType || "image/jpeg",
            })),
          ].slice(0, editor.imageLimit)
        );
      }
    } catch {
      setValidation("Could not open photos. Check photo permissions.");
    }
  };

  const confirmLabel = busy ? "Saving…" : isRequest ? "Send request" : "Confirm";

  return (
    <Modal visible animationType="slide" onRequestClose={() => { if (!busy) close(); }}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            disabled={busy}
            onPress={close}
            style={({ pressed }) => [styles.back, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        >
          <Text style={styles.title}>{editor.title}</Text>
          {isRequest ? (
            <Text style={styles.intro}>
              {editor.title === "Help me deliver"
                ? "Tell agents where to pick up and drop off. Map pins can be added after the request is created."
                : "Describe what you need. Delivery details help the agent; map pins can be added later."}
            </Text>
          ) : null}

          {fields.map((f) => {
            const selected = values[f.key];
            const choices = [...(!f.required ? [{ value: "", label: "None" }] : []), ...(f.options || [])];
            const addressField = f.key === "pickupAddress" || f.key === "destinationAddress";
            return (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>
                  {f.label}
                  {f.required ? " *" : ""}
                </Text>
                {f.options ? (
                  <View style={[styles.chips, f.key === "recipient" && styles.chipsSplit]}>
                    {choices.map((o) => {
                      const on = selected === o.value;
                      return (
                        <Pressable
                          key={o.value || "none"}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          disabled={busy}
                          onPress={() => setValues((v) => ({ ...v, [f.key]: o.value }))}
                          style={[styles.chip, f.key === "recipient" && styles.chipGrow, on && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    accessibilityLabel={f.label}
                    editable={!busy}
                    value={values[f.key]}
                    onChangeText={(text) =>
                      setValues((v) => ({
                        ...v,
                        [f.key]: f.type === "money" ? formatMoneyInput(text) : text,
                      }))
                    }
                    placeholder={addressField ? "Street, area, Jos" : f.type === "money" ? "1,234,500" : undefined}
                    placeholderTextColor={c.textMuted}
                    secureTextEntry={f.type === "password"}
                    keyboardType={f.type === "number" || f.type === "money" ? "numbers-and-punctuation" : "default"}
                    multiline={f.type === "multiline"}
                    textAlignVertical={f.type === "multiline" ? "top" : "center"}
                    style={[styles.input, f.type === "multiline" && styles.inputMulti]}
                  />
                )}
                {isRequest && addressField ? (
                  <Text style={styles.helper}>Coordinates are optional. Set the pin on the map after this request is created.</Text>
                ) : null}
              </View>
            );
          })}

          {editor.imageLimit ? (
            <View style={styles.field}>
              <Text style={styles.label}>Photos ({images.length}/{editor.imageLimit})</Text>
              {isRequest ? <Text style={styles.helper}>Up to {editor.imageLimit} photos. These upload with the request.</Text> : null}
              <View style={styles.photos}>
                {images.map((image, index) => {
                  const uri = "uri" in image ? image.uri : undefined;
                  return (
                  <View key={`${uri || "file"}-${index}`} style={styles.thumbWrap}>
                    {uri ? <Image source={{ uri }} style={styles.thumb} /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      disabled={busy}
                      onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                      style={styles.thumbRemove}
                    >
                      <Ionicons name="close" size={14} color={c.white} />
                    </Pressable>
                  </View>
                  );
                })}
                {images.length < editor.imageLimit ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void pick()}
                    style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}
                  >
                    <Ionicons name="camera-outline" size={22} color={c.textMuted} />
                    <Text style={styles.addPhotoText}>Add photo</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {validation || error ? (
            <Text accessibilityRole="alert" style={styles.alert}>
              {validation || error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              const missing = fields.find((f) => f.required && !values[f.key]?.trim());
              if (missing) {
                setValidation(`${missing.label} is required`);
                return;
              }
              const invalidMoney = fields.find((f) => {
                if (f.type !== "money" || !values[f.key]?.trim()) return false;
                const amount = parseMoneyInput(values[f.key]);
                return amount == null || Number.isNaN(amount);
              });
              if (invalidMoney) {
                setValidation(`Enter a valid ${invalidMoney.label.toLowerCase()}, for example 1,234,500`);
                return;
              }
              const payload = { ...values };
              for (const f of fields) {
                if (f.type !== "money") continue;
                const amount = parseMoneyInput(values[f.key]);
                payload[f.key] = amount == null || Number.isNaN(amount) ? "" : String(amount);
              }
              setValidation("");
              save(payload, images);
            }}
            style={({ pressed }) => [styles.submit, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.submitText}>{confirmLabel}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AuthenticatedWorkspace({ role = "agent", page = "dashboard" }: { role?: "agent" | "requester"; page?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ service?: string; agent?: string; item?: string }>();
  const w = useAgentWorkspace(
    role,
    page === "settings" ? "profile" : page,
    params.service === "deliver" ? "delivery" : "buy",
    params.agent || ""
  );
  const workspace = useRef(w);
  workspace.current = w;
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [payJob, setPayJob] = useState<Job | null>(null);
  const [rateJob, setRateJob] = useState<Job | null>(null);
  useEffect(() => {
    if (page !== "requests") return;
    const agent = String(params.agent || "");
    const itemId = Number(params.item || 0);
    if (!agent) return;
    let cancelled = false;
    void (async () => {
      if (itemId > 0) {
        try {
          const item = await agentApi.catalogueItem(itemId);
          if (!cancelled) {
            workspace.current.setService("buy");
            workspace.current.openRequest(agent, item);
          }
          return;
        } catch {
          /* fall through to a plain request */
        }
      }
      if (!cancelled) workspace.current.openRequest(agent);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, params.agent, params.item]);

  return (
    <FeedShell tab="explore">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.title}>{role === "agent" ? "Agent workspace" : "Shopping & delivery"}</Text>
        <Text style={styles.intro}>
          {role === "agent"
            ? "Manage requests, jobs, and your catalogue."
            : "Find an agent, create a request, or track a delivery."}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {w.tabs.map((tab) => {
            const on = w.tab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => w.setTab(tab)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{TAB_LABELS[tab] || tab}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.tools}>
          {role === "agent" ? (
            <Pressable
              onPress={() => router.push("/agents/map" as never)}
              style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
            >
              <Ionicons name="map-outline" size={18} color={colors.text} />
              <Text style={styles.toolText}>Map</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push((role === "agent" ? "/agents/wallet" : "/profile/wallet") as never)}
            style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
          >
            <Ionicons name="wallet-outline" size={18} color={colors.text} />
            <Text style={styles.toolText}>Wallet</Text>
          </Pressable>
        </View>

        {["directory", "requests"].includes(w.tab) ? (
          <View style={styles.layers}>
            {(["buy", "delivery"] as const).map((type) => {
              const on = w.service === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => w.setService(type)}
                  style={[styles.layerChip, on && styles.layerChipOn]}
                >
                  <Text style={[styles.layerText, on && styles.layerTextOn]}>
                    {type === "buy" ? "Help me buy" : "Help me deliver"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {w.tab === "directory" || (role === "agent" && w.tab === "catalogue") ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              accessibilityLabel="Search"
              placeholder={w.tab === "directory" ? "Search agents" : "Search catalogue"}
              placeholderTextColor={colors.textMuted}
              value={w.search}
              onChangeText={w.setSearch}
              style={styles.searchInput}
            />
          </View>
        ) : null}

        {role === "requester" ? (
          <Pressable onPress={() => w.openRequest()} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>Create request</Text>
          </Pressable>
        ) : null}
        {role === "agent" && w.tab === "catalogue" ? (
          <Pressable
            onPress={() => w.catalogueEditor()}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnText}>Add catalogue item</Text>
          </Pressable>
        ) : null}

        {w.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {w.error}
          </Text>
        ) : null}
        {w.notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {w.notice}
          </Text>
        ) : null}

        {w.loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
        ) : w.panels.length === 0 && !w.error ? (
          <Text style={styles.empty}>Nothing here yet.</Text>
        ) : (
          w.panels.map((panel) => {
            const actionButtons = panel.actions?.length ? (
              <View style={styles.cardActions}>
                {panel.actions.map((action) => {
                  const primary = /request this agent|fund from wallet|confirm received/i.test(action.label);
                  return (
                    <Pressable
                      key={action.label}
                      disabled={w.busy || action.disabled}
                      onPress={() => {
                        if (action.profileUserId) {
                          openMemberProfile(router, action.profileUserId, "agent", "push", {
                            name: panel.title,
                            picture: action.picture,
                          });
                          return;
                        }
                        action.run();
                      }}
                      style={({ pressed }) => [
                        primary ? styles.requestBtn : styles.secondaryBtn,
                        pressed && !action.disabled && styles.pressed,
                        (w.busy || action.disabled) && styles.disabled,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={primary ? styles.requestBtnText : styles.secondaryBtnText}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null;

            if (panel.job) {
              return (
                <View key={panel.key} style={{ gap: 10 }}>
                  <AgentJobCard
                    job={panel.job}
                    role={role}
                    expanded={expandedJob === panel.key}
                    advancing={w.busy}
                    onToggle={() => setExpandedJob((current) => (current === panel.key ? null : panel.key))}
                    onAdvance={
                      role === "agent"
                        ? () => void w.run(() => agentApi.advance(panel.job!.job_id), "Stage updated")
                        : undefined
                    }
                    onPurchase={role === "agent" ? () => setPayJob(panel.job!) : undefined}
                    onConfirm={
                      role === "requester"
                        ? () =>
                            void w.run(async () => {
                              const result = await agentApi.confirm(panel.job!.job_id);
                              if (result.needs_review !== false) setRateJob({ ...panel.job!, stage: 4, reviewed: false });
                              return "Delivery confirmed. The agent’s commission is now in their wallet.";
                            })
                        : undefined
                    }
                    onRate={role === "requester" ? () => setRateJob(panel.job!) : undefined}
                  />
                  {actionButtons}
                </View>
              );
            }

            return (
            <View key={panel.key} style={styles.card}>
              <Text style={styles.cardTitle}>{panel.title}</Text>
              {panel.lines.filter(Boolean).map((line, i) => (
                <Text selectable key={i} style={styles.cardLine}>
                  {line}
                </Text>
              ))}
              {panel.images?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
                  {panel.images.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.image} />
                  ))}
                </ScrollView>
              ) : null}
              {actionButtons}
            </View>
            );
          })
        )}

        {["requests", "jobs", "directory"].includes(w.tab) && (w.page > 1 || w.panels.length >= 20) ? (
          <View style={styles.pager}>
            <Pressable
              disabled={w.page <= 1 || w.loading}
              onPress={() => w.setPage((p) => p - 1)}
              style={[styles.secondaryBtn, styles.pagerBtn, (w.page <= 1 || w.loading) && styles.disabled]}
            >
              <Text style={styles.secondaryBtnText}>Previous</Text>
            </Pressable>
            <Text style={styles.pageLabel}>Page {w.page}</Text>
            <Pressable
              disabled={w.panels.length < 20 || w.loading}
              onPress={() => w.setPage((p) => p + 1)}
              style={[styles.secondaryBtn, styles.pagerBtn, (w.panels.length < 20 || w.loading) && styles.disabled]}
            >
              <Text style={styles.secondaryBtnText}>Next</Text>
            </Pressable>
          </View>
        ) : null}

        {page === "settings" ? (
          <Pressable
            onPress={() => router.push("/profile/settings" as never)}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryBtnText}>Account settings</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <AgentVendorPaySheet
        job={payJob}
        onClose={() => setPayJob(null)}
        onDone={() => {
          setPayJob(null);
          w.refresh();
        }}
      />
      <AgentRatingSheet
        job={rateJob}
        onClose={() => setRateJob(null)}
        onDone={() => {
          setRateJob(null);
          w.refresh();
        }}
      />
      {w.editor ? (
        <EditForm
          key={w.editor.title}
          editor={w.editor}
          error={w.error}
          busy={w.busy}
          close={() => w.setEditor(null)}
          save={(v, images) => void w.run(() => w.editor!.submit(v, images))}
        />
      ) : null}
    </FeedShell>
  );
}

function makeFormStyles(colors: Palette) {
  return StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 8,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    back: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      minHeight: 44,
      paddingHorizontal: 8,
    },
    backLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 16,
      color: colors.text,
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 16,
      gap: 16,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 26,
      color: colors.text,
    },
    intro: {
      marginTop: -8,
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    field: {
      gap: 8,
    },
    label: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    helper: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    input: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.fieldBorder,
      backgroundColor: colors.fieldBg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
    },
    inputMulti: {
      minHeight: 96,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chipsSplit: {
      flexWrap: "nowrap",
    },
    chip: {
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    chipGrow: {
      flex: 1,
    },
    chipOn: {
      backgroundColor: colors.navActive,
      borderColor: colors.navActive,
    },
    chipText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.textMuted,
    },
    chipTextOn: {
      color: colors.text,
    },
    photos: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    thumbWrap: {
      width: 88,
      height: 88,
    },
    thumb: {
      width: 88,
      height: 88,
      borderRadius: 14,
      backgroundColor: colors.cream,
    },
    thumbRemove: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },
    addPhoto: {
      width: 88,
      height: 88,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cream,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    addPhotoText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 11,
      color: colors.textMuted,
    },
    alert: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.error,
    },
    submit: {
      minHeight: 52,
      borderRadius: 26,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    submitText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingBottom: TAB_BAR_SPACE + 28,
      gap: 12,
    },
    title: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 28,
      color: colors.text,
    },
    intro: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginTop: -4,
    },
    tabs: {
      gap: 8,
      paddingRight: 8,
    },
    tab: {
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    tabOn: {
      backgroundColor: colors.navActive,
      borderColor: colors.navActive,
    },
    tabText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.textMuted,
    },
    tabTextOn: {
      color: colors.text,
    },
    tools: {
      flexDirection: "row",
      gap: 8,
    },
    tool: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
    },
    toolText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 12,
      color: colors.text,
    },
    layers: {
      flexDirection: "row",
      gap: 8,
    },
    layerChip: {
      flex: 1,
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    layerChipOn: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    layerText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    layerTextOn: {
      color: colors.white,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      fontFamily: "Montserrat_400Regular",
      fontSize: 15,
      color: colors.text,
      paddingVertical: 12,
    },
    primaryBtn: {
      minHeight: 48,
      borderRadius: 24,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    primaryBtnText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
    },
    secondaryBtn: {
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    secondaryBtnText: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    error: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.error,
    },
    notice: {
      fontFamily: "Montserrat_500Medium",
      fontSize: 13,
      color: colors.primary,
    },
    empty: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
    },
    cardTitle: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 17,
      color: colors.text,
    },
    cardLine: {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
    images: {
      gap: 8,
      paddingTop: 4,
    },
    image: {
      width: 120,
      height: 100,
      borderRadius: 12,
    },
    requestBtn: {
      minHeight: 48,
      borderRadius: 24,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    requestBtnText: {
      fontFamily: "Montserrat_700Bold",
      fontSize: 15,
      color: colors.white,
      textAlign: "center",
    },
    cardActions: {
      gap: 8,
      marginTop: 10,
    },
    pager: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    pagerBtn: {
      flex: 1,
    },
    pageLabel: {
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 13,
      color: colors.text,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}

export default function AgentWorkspaceScreen(props: { role?: 'agent' | 'requester'; page?: string }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null), router = useRouter();
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const role = props.role || 'agent';
  useFocusEffect(useCallback(() => {
    let active = true;
    void getAuthToken().then(token => { if (active) setAuthenticated(Boolean(token)); });
    return () => { active = false; };
  }, []));
  if (authenticated === null) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}><JosCityLoader color={c.primary} size="large" /></View>;
  }
  if (!authenticated) {
    const agent = role === 'agent';
    return <FeedShell tab="explore" showTabBar={!agent} hideHeader={agent}>
      <View style={{ padding: 24, paddingTop: Math.max(insets.top, 24), gap: 18, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        {agent && <AppButton label="Back" variant="secondary" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/welcome' as never); }} />}
        <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>{agent ? 'Become an agent' : 'Shopping & delivery'}</Text>
        <Text style={{ color: c.text, lineHeight: 22 }}>{agent ? 'Sign in with your JosCity account to offer shopping and delivery, or create an account first.' : 'Sign in with your JosCity account to request shopping and delivery. Your existing account and wallet are used.'}</Text>
        <AppButton label="Sign in" onPress={() => router.push({ pathname: '/login', params: { type: agent ? 'agent' : 'personal' } })} />
        <AppButton label={agent ? 'Create an agent account' : 'Create a personal account'} variant="secondary" onPress={() => router.push((agent ? '/register/agent' : '/register/personal') as never)} />
      </View>
    </FeedShell>;
  }
  return <AuthenticatedWorkspace {...props} />;
}
