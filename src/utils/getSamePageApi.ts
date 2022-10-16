const getSamePageApi = () =>
  window.roamjs.extension.samepage || window.roamjs.extension.multiplayer;

export default getSamePageApi;
