// @ts-check
import https from "node:https";
import tls from "node:tls";
import fs from "node:fs";

if (typeof process.env.NODE_EXTRA_CA_CERTS === "string") {
  const extraCerts = process.env.NODE_EXTRA_CA_CERTS.split(",").map((certPath) =>
    fs.readFileSync(certPath, "utf8")
  );

  https.globalAgent.options.ca = [...tls.rootCertificates, ...extraCerts];
}
