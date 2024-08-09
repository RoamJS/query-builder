import React, { useEffect, useState } from "react";
import { Dialog, Button } from "@blueprintjs/core";
import init, { KeyPair, Nanopub, NpProfile, getNpServer } from "@nanopub/sign";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { getNodeEnv } from "roamjs-components/util/env";
import rdfString from "./exampleRdfString";

const SERVER_URL =
  getNodeEnv() === "development"
    ? "" // leave blank to publish to test server
    : getNpServer(false);
const PRIVATE_KEY = getNodeEnv() === "development" ? "" : "";
const ORCID = "https://orcid.org/0000-0000-0000-0000";
const NAME = "Test User";
const RDF_STR = rdfString;

const NanopubDialog = () => {
  const [isWasmReady, setWasmReady] = useState(false);

  useEffect(() => {
    init().then(async () => {
      // Adjusted usage
      console.log("WASM is ready");
      // setWasmReady(true); // Set a flag when WASM is ready
    });
  }, []);

  const [isOpen, setIsOpen] = useState(true);

  const generateKeyPair = async () => {
    if (!isWasmReady) {
      console.error("WASM is not ready. Please wait.");
      return;
    }
    let keyPair = new KeyPair();
    // console.log("KeyPair:", keyPair);
    // return keyPair.toJs(); // Assuming you want to return the JavaScript object representation
  };

  const handleClose = () => setIsOpen(false);

  const handlePublishIntro = async () => {
    try {
      const profile = new NpProfile(PRIVATE_KEY, ORCID, NAME, "");
      const np = new Nanopub(RDF_STR);
      const result = await np.publish(profile, SERVER_URL);

      console.log("Nanopub:", np.info());
      console.log("Published:", result.info());

      console.log("Info");
      console.log("-----------------");
      console.log("Private Key:", PRIVATE_KEY);
      console.log("ORCID:", ORCID);
      console.log("Name:", NAME);
      console.log("Server URL:", SERVER_URL);
      // console.log("RDF:", RDF_STR);
      console.log("-----------------");

      // handleClose();
    } catch (error) {
      console.error("Error publishing nanopub:", error);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Nanopub Publication"
      autoFocus={false}
      enforceFocus={false}
    >
      <div className="bp3-dialog-body">
        <p>Are you sure you want to publish this nanopub?</p>
      </div>
      <div className="bp3-dialog-footer">
        <div className="bp3-dialog-footer-actions">
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handlePublishIntro} intent={"primary"}>
            Publish Intro
          </Button>
          <Button
            onClick={() => console.log(generateKeyPair())}
            intent={"none"}
          >
            Generate and log KeyPair
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const render = () => renderOverlay({ Overlay: NanopubDialog });
