const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TECH_FILTER = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
  <tech-list>
    <tech>android.nfc.tech.Ndef</tech>
  </tech-list>
  <tech-list>
    <tech>android.nfc.tech.NfcA</tech>
  </tech-list>
  <tech-list>
    <tech>android.nfc.tech.MifareUltralight</tech>
  </tech-list>
</resources>
`;

function hasAction(filter, name) {
  return (filter.action || []).some((action) => action.$?.["android:name"] === name);
}

/** Android-only. NFC stays optional so phones without it can still install. */
function withOptionalNfc(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const permissions = manifest["uses-permission"] || [];
    if (!permissions.some((item) => item.$?.["android:name"] === "android.permission.NFC")) {
      permissions.push({ $: { "android:name": "android.permission.NFC" } });
    }
    manifest["uses-permission"] = permissions;

    const features = manifest["uses-feature"] || [];
    const featureName = "android.hardware.nfc";
    const existing = features.find((feature) => feature.$?.["android:name"] === featureName);
    if (existing) {
      existing.$["android:required"] = "false";
    } else {
      features.push({ $: { "android:name": featureName, "android:required": "false" } });
    }
    manifest["uses-feature"] = features;

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    if (!activity.$["android:launchMode"]) {
      activity.$["android:launchMode"] = "singleTask";
    }

    const filters = activity["intent-filter"] || [];
    if (!filters.some((filter) => hasAction(filter, "android.nfc.action.NDEF_DISCOVERED"))) {
      filters.push({
        action: [{ $: { "android:name": "android.nfc.action.NDEF_DISCOVERED" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": "text/plain" } }],
      });
    }
    if (!filters.some((filter) => hasAction(filter, "android.nfc.action.TECH_DISCOVERED"))) {
      filters.push({
        action: [{ $: { "android:name": "android.nfc.action.TECH_DISCOVERED" } }],
      });
    }
    if (!filters.some((filter) => hasAction(filter, "android.nfc.action.TAG_DISCOVERED"))) {
      filters.push({
        action: [{ $: { "android:name": "android.nfc.action.TAG_DISCOVERED" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      });
    }
    activity["intent-filter"] = filters;

    const meta = activity["meta-data"] || [];
    if (!meta.some((item) => item.$?.["android:name"] === "android.nfc.action.TECH_DISCOVERED")) {
      meta.push({
        $: {
          "android:name": "android.nfc.action.TECH_DISCOVERED",
          "android:resource": "@xml/nfc_tech_filter",
        },
      });
    }
    activity["meta-data"] = meta;
    application.activity = application.activity || [];
    return mod;
  });

  return withDangerousMod(config, [
    "android",
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "nfc_tech_filter.xml"), TECH_FILTER);
      return mod;
    },
  ]);
}

module.exports = withOptionalNfc;
