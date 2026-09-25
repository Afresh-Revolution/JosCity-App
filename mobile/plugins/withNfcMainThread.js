const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** iOS rejects an NFC session that is not started on the main thread. */
function withNfcMainThread(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const file = path.join(
        config.modRequest.projectRoot,
        "node_modules/react-native-nfc-manager/ios/NfcManager.m"
      );
      if (!fs.existsSync(file)) return config;
      const source = fs.readFileSync(file, "utf8");
      const needle = "[tagSession beginSession];";
      const wrapped =
        "dispatch_async(dispatch_get_main_queue(), ^{\n                [tagSession beginSession];\n            });";
      if (source.includes(needle) && !source.includes("dispatch_async(dispatch_get_main_queue(), ^{\n                [tagSession beginSession];")) {
        fs.writeFileSync(file, source.replace(needle, wrapped));
      }
      return config;
    },
  ]);
}

module.exports = withNfcMainThread;
