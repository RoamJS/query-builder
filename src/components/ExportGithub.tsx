import { Button, Label } from "@blueprintjs/core";
import nanoid from "nanoid";
import React, { useCallback, useEffect, useRef, useState } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import apiGet from "roamjs-components/util/apiGet";
import { getNodeEnv } from "roamjs-components/util/env";
import apiPost from "roamjs-components/util/apiPost";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";

export type UserReposResponse = {
  data: [
    {
      name: string;
      full_name: string;
    }
  ];
  status: number;
};
export type UserRepos = UserReposResponse["data"];
export const initialRepos: UserRepos = [{ name: "", full_name: "" }];
export type GitHubDestination = "Issue" | "File";
const GITHUB_DESTINATIONS: GitHubDestination[] = ["Issue", "File"];

export const WINDOW_WIDTH = 600;
export const WINDOW_HEIGHT = 525;
export const WINDOW_LEFT =
  window.screenX + (window.innerWidth - WINDOW_WIDTH) / 2;
export const WINDOW_TOP =
  window.screenY + (window.innerHeight - WINDOW_HEIGHT) / 2;

const isDev = getNodeEnv() === "development";

export const fetchInstallationStatus = async () => {
  try {
    const res = await apiGet<{ installations: { app_id: number }[] }>({
      domain: "https://api.github.com",
      path: "user/installations",
      headers: {
        Authorization: `token ${localStorageGet("oauth-github")}`,
      },
    });
    const installations = res.installations;
    const APP_ID = isDev ? 882491 : 312167; // TODO - pull from process.env.GITHUB_APP_ID
    const isAppInstalled = installations.some(
      (installation) => installation.app_id === APP_ID
    );
    return isAppInstalled;
  } catch (error) {
    const e = error as Error;
    return false;
  }
};

export const ExportGithub = ({
  isVisible,
  selectedRepo,
  setSelectedRepo,
  setError,
  gitHubAccessToken,
  setGitHubAccessToken,
  setCanSendToGitHub,
  githubDestination,
  setGithubDestination,
}: {
  isVisible: boolean;
  selectedRepo: string;
  setSelectedRepo: (selectedRepo: string) => void;
  setError: (error: string) => void;
  gitHubAccessToken: string | null;
  setGitHubAccessToken: (gitHubAccessToken: string | null) => void;
  setCanSendToGitHub: (canSendToGitHub: boolean) => void;
  githubDestination: GitHubDestination;
  setGithubDestination: (githubDestination: GitHubDestination) => void;
}) => {
  const authWindow = useRef<Window | null>(null);

  const [isGitHubAppInstalled, setIsGitHubAppInstalled] = useState(false);
  const [clickedInstall, setClickedInstall] = useState(false);
  const [repos, setRepos] = useState<UserRepos>(initialRepos);
  const [state, setState] = useState("");
  const showGitHubLogin = isGitHubAppInstalled && !gitHubAccessToken;
  const repoAndDestinationSelectEnabled =
    isGitHubAppInstalled && gitHubAccessToken;

  const setRepo = (repo: string) => {
    setSelectedRepo(repo);
    localStorageSet("selected-repo", repo);
  };

  const handleReceivedAccessToken = (token: string) => {
    localStorageSet("oauth-github", token);
    setGitHubAccessToken(token);
    setClickedInstall(false);
    authWindow.current?.close();
  };

  const fetchAndSetInstallation = useCallback(async () => {
    try {
      const isAppInstalled = await fetchInstallationStatus();
      setIsGitHubAppInstalled(isAppInstalled);
    } catch (error) {
      const e = error as Error;
      if (e.message === "Bad credentials") {
        setGitHubAccessToken(null);
        localStorageSet("oauth-github", "");
      }
    }
  }, []);

  // listen for messages from the auth window
  useEffect(() => {
    const otp = nanoid().replace(/_/g, "-");
    const key = nanoid().replace(/_/g, "-");
    const state = `github_${otp}_${key}`;
    setState(state);
    const handleGitHubAuthMessage = (event: MessageEvent) => {
      const targetOrigin = isDev
        ? "https://samepage.ngrok.io"
        : "https://samepage.network";
      if (event.data && event.origin === targetOrigin) {
        handleReceivedAccessToken(event.data);
      }
    };

    if (isVisible) {
      window.addEventListener("message", handleGitHubAuthMessage);
    }

    return () => {
      if (isVisible) {
        window.removeEventListener("message", handleGitHubAuthMessage);
      }
    };
  }, [isVisible]);

  // check for installation
  useEffect(() => {
    if (gitHubAccessToken) fetchAndSetInstallation();
  }, [gitHubAccessToken]);

  // get the list of repos
  useEffect(() => {
    if (!gitHubAccessToken || !isGitHubAppInstalled) return;
    const fetchAndSetRepos = async () => {
      try {
        const res = await apiGet<UserReposResponse>({
          domain: "https://api.github.com",
          path: "user/repos?per_page=100&type=owner",
          headers: {
            Authorization: `token ${gitHubAccessToken}`,
          },
        });
        setError("");
        setRepos(res.data);
      } catch (error) {
        setError("Failed to fetch repositories");
      }
    };
    fetchAndSetRepos();
  }, [gitHubAccessToken, isGitHubAppInstalled]);

  // gatekeep export button
  useEffect(() => {
    if (gitHubAccessToken && isGitHubAppInstalled && selectedRepo) {
      setCanSendToGitHub(true);
    }
  }, [gitHubAccessToken, isGitHubAppInstalled, selectedRepo]);

  if (!isVisible) return null;
  return (
    <div className="flex mb-4">
      {(!isGitHubAppInstalled || clickedInstall) && (
        <div className="flex flex-col">
          {!isGitHubAppInstalled && (
            <Button
              text="Install SamePage App"
              id="qb-install-button"
              icon="cloud-download"
              className={clickedInstall ? "opacity-30 hover:opacity-100" : ""}
              intent={clickedInstall ? "none" : "primary"}
              onClick={async () => {
                authWindow.current = window.open(
                  isDev
                    ? "https://github.com/apps/samepage-network-dev"
                    : "https://github.com/apps/samepage-network",
                  "_blank",
                  `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`
                );
                setClickedInstall(true);
                document.getElementById("qb-install-button")?.blur();
              }}
            />
          )}
          {clickedInstall && (
            <Button
              text="Confirm Installation"
              icon="confirm"
              intent="primary"
              onClick={async () => {
                setClickedInstall(false);
                setIsGitHubAppInstalled(true);
              }}
            />
          )}
        </div>
      )}
      {showGitHubLogin && (
        <Button
          text="Authorize"
          icon="key"
          intent="primary"
          onClick={async () => {
            const params = isDev
              ? `client_id=Iv1.4bf062a6c6636672&state=${state}`
              : `client_id=Iv1.e7e282a385b7b2da&state=${state}`;
            authWindow.current = window.open(
              isDev
                ? `https://github.com/login/oauth/authorize?${params}`
                : `https://github.com/login/oauth/authorize?${params}`,
              "_blank",
              `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`
            );

            let attemptCount = 0;
            const check = () => {
              if (attemptCount < 30) {
                apiPost({
                  path: "access-token",
                  domain: isDev
                    ? "https://api.samepage.ngrok.io"
                    : "https://api.samepage.network",
                  data: { state },
                }).then((r) => {
                  if (r.accessToken) {
                    handleReceivedAccessToken(r.accessToken);
                  } else {
                    attemptCount++;
                    setTimeout(check, 1000);
                  }
                });
              } else {
                setError("Something went wrong.  Please contact support.");
              }
            };
            setTimeout(check, 1500);
          }}
        />
      )}
      {repoAndDestinationSelectEnabled && (
        <div className="flex flex-col">
          <Label className="flex flex-col">
            Repo
            <MenuItemSelect
              items={repos.map((repo) => repo.full_name)}
              onItemSelect={setRepo}
              activeItem={selectedRepo}
              filterable={true}
              transformItem={(item) => item.split("/")[1]}
              emptyValueText="Choose Repo"
            />
          </Label>
          <Label>
            Type
            <MenuItemSelect
              items={GITHUB_DESTINATIONS}
              onItemSelect={setGithubDestination}
              activeItem={githubDestination}
            />
          </Label>
        </div>
      )}
    </div>
  );
};
