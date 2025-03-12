import apiPost from "roamjs-components/util/apiPost";

const sendErrorEmail = ({
  error,
  data,
  type,
}: {
  error: Error;
  data?: Record<string, unknown>;
  type: string;
}) => {
  const isEncrypted = window.roamAlphaAPI.graph.isEncrypted;
  const isOffline = window.roamAlphaAPI.graph.type === "offline";
  if (isEncrypted || isOffline) return;

  apiPost({
    domain: "https://api.samepage.network",
    path: "errors",
    data: {
      method: "extension-error",
      type,
      message: error.message,
      stack: error.stack,
      version: process.env.VERSION,
      notebookUuid: JSON.stringify({
        owner: "RoamJS",
        app: "query-builder",
        workspace: window.roamAlphaAPI.graph.name,
      }),
      data,
    },
  }).catch(() => {});
};

export default sendErrorEmail;
