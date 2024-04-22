import { Button } from "@blueprintjs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import apiGet from "roamjs-components/util/apiGet";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";

type UserReposResponse = {
  data: [
    {
      name: string;
      full_name: string;
    }
  ];
  status: number;
};
type UserRepos = UserReposResponse["data"];
const initialRepos: UserRepos = [{ name: "", full_name: "" }];

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 525;
const WINDOW_LEFT = window.screenX + (window.innerWidth - WINDOW_WIDTH) / 2;
const WINDOW_TOP = window.screenY + (window.innerHeight - WINDOW_HEIGHT) / 2;

export const ExportGithub = ({
  isVisible,
  selectedRepo,
  setSelectedRepo,
  setError,
  gitHubAccessToken,
  setGitHubAccessToken,
  setCanSendToGitHub,
}: {
  isVisible: boolean;
  selectedRepo: string;
  setSelectedRepo: (selectedRepo: string) => void;
  setError: (error: string) => void;
  gitHubAccessToken: string | null;
  setGitHubAccessToken: (gitHubAccessToken: string | null) => void;
  setCanSendToGitHub: (canSendToGitHub: boolean) => void;
}) => {
  const authWindow = useRef<Window | null>(null);

  const [isGitHubAppInstalled, setIsGitHubAppInstalled] = useState(false);
  const [clickedInstall, setClickedInstall] = useState(false);
  const [repos, setRepos] = useState<UserRepos>(initialRepos);
  const showGitHubLogin = isGitHubAppInstalled && !gitHubAccessToken;
  const repoSelectEnabled = isGitHubAppInstalled && gitHubAccessToken;

  const setRepo = (repo: string) => {
    setSelectedRepo(repo);
    localStorageSet("selected-repo", repo);
  };

  const fetchAndSetInstallation = useCallback(async () => {
    try {
      const res = await apiGet<{ installations: { app_id: number }[] }>({
        domain: "https://api.github.com",
        path: "user/installations",
        headers: {
          Authorization: `token ${localStorageGet("oauth-github")}`,
        },
      });
      const installations = res.installations;
      const APP_ID = Number(process.env.GITHUB_APP_ID);
      const isAppInstalled = installations.some(
        (installation) => installation.app_id === APP_ID
      );
      setIsGitHubAppInstalled(isAppInstalled);
      return isAppInstalled;
    } catch (error) {
      const e = error as Error;
      if (e.message === "Bad credentials") {
        setGitHubAccessToken(null);
        localStorageSet("oauth-github", "");
      }
      return false;
    }
  }, []);

  // listen for messages from the auth window
  useEffect(() => {
    const handleGitHubAuthMessage = (event: MessageEvent) => {
      const targetOrigin =
        process.env.NODE_ENV !== "production"
          ? "https://samepage.ngrok.io"
          : "https://samepage.network";
      if (event.data && event.origin === targetOrigin) {
        localStorageSet("oauth-github", event.data);
        setGitHubAccessToken(event.data);
        setClickedInstall(false);
        authWindow.current?.close();
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
                "https://github.com/apps/samepage-network",
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
      {showGitHubLogin && (
        <Button
          text="Authorize"
          icon="key"
          intent="primary"
          onClick={async () => {
            authWindow.current = window.open(
              "https://github.com/login/oauth/authorize?client_id=Iv1.e7e282a385b7b2da",
              "_blank",
              `width=${WINDOW_WIDTH}, height=${WINDOW_HEIGHT}, top=${WINDOW_TOP}, left=${WINDOW_LEFT}`
            );
          }}
        />
      )}
      {repoSelectEnabled && (
        <MenuItemSelect
          items={repos.map((repo) => repo.full_name)}
          onItemSelect={setRepo}
          activeItem={selectedRepo}
          filterable={true}
          transformItem={(item) => item.split("/")[1]}
          emptyValueText="Choose Repo"
        />
      )}
    </div>
  );
};
