import { useEffect, useState, useCallback, FC } from "react";
import path from "path-browserify";
import {
  Tree,
  TreeNodeInfo,
  Divider,
  Navbar,
  NavbarGroup,
  NavbarDivider,
  Dialog,
  Classes,
  Spinner,
  Intent,
  Button,
  OverlayToaster,
} from "@blueprintjs/core";
import GitHubButton from "react-github-btn";
import {
  getRepositoryUrl,
  PackageMetaDirectory,
  PackageMetaItem,
  fetchMeta,
  fetchPackageJson,
  fetchCode,
  centerStyles,
  HEADER_HEIGHT,
} from "./utils";
import { Entry } from "./entry";
import { useParams } from "react-router-dom";
import { Preview } from "./preview";
import { P, match } from "ts-pattern";

// https://stackoverflow.com/a/73974452
const fileSizeFormatter = Intl.NumberFormat("en", {
  notation: "compact",
  style: "unit",
  unit: "byte",
  unitDisplay: "narrow",
});

export const Component: FC = () => {
  const { scope, name: nameWithVersion } = useParams<"scope" | "name">();

  let { name, version } = match(nameWithVersion?.split("@"))
    .with([P.string, P.string], ([name, version]) => {
      return { name, version };
    })
    .with([P.string], ([name]) => {
      return { name, version: undefined };
    })
    .otherwise(() => {
      throw new Error("should not be here");
    });
  const fullName = scope ? scope + "/" + name : name;

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [meta, setMeta] = useState<PackageMetaDirectory>();
  const [packageJson, setPackageJson] = useState<any>();
  const [expandedMap, setExpandedMap] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [selected, setSelected] = useState<string>();
  const [loadingCode, setLoadingCode] = useState(false);
  const [code, setCode] = useState<string>();
  const [ext, setExt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setSelected(undefined);
        setCode(undefined);
        setLoadingMeta(true);
        const _packageJson = await fetchPackageJson(
          version ? `${fullName}@${version}` : fullName
        );
        setPackageJson(_packageJson);
        setMeta(await fetchMeta(`${fullName}@${_packageJson.version}`));
      } catch (err) {
        console.error(err);
        OverlayToaster.create().show({
          message: (err as Error).message,
          intent: Intent.DANGER,
        });
      } finally {
        setLoadingMeta(false);
      }
    };
    init();
  }, [fullName, version]);

  const convertMetaToTreeNode = (
    file: PackageMetaItem
  ): TreeNodeInfo<PackageMetaItem> => {
    switch (file.type) {
      case "directory":
        file.files.sort((a, b) => {
          // Directory first
          if (a.type === "directory" && b.type === "file") {
            return -1;
          } else if (a.type === "file" && b.type === "directory") {
            return 1;
          } else {
            // Then sorted by first char
            return (
              path.basename(a.path).charCodeAt(0) -
              path.basename(b.path).charCodeAt(0)
            );
          }
        });
        return {
          id: file.path,
          nodeData: file,
          icon: "folder-close",
          label: path.basename(file.path),
          childNodes: file.files.map(convertMetaToTreeNode),
          isExpanded: !!expandedMap[file.path],
          isSelected: selected === file.path,
        };
      case "file":
        return {
          id: file.path,
          nodeData: file,
          icon: "document",
          label: path.basename(file.path),
          secondaryLabel: fileSizeFormatter.format(file.size),
          isSelected: selected === file.path,
        };
    }
  };

  const handleClick = useCallback(
    async (node: TreeNodeInfo<PackageMetaItem>) => {
      if (!node.nodeData) return;

      switch (node.nodeData.type) {
        case "directory":
          setSelected(node.id as string);
          setExpandedMap((old) => ({ ...old, [node.id]: !old[node.id] }));
          break;
        case "file":
          if (selected === node.id) return;

          setSelected(node.id as string);
          try {
            setLoadingCode(true);
            setCode(
              await fetchCode(
                `${fullName}@${packageJson.version}`,
                node.id as string
              )
            );
            setExt(path.extname(node.id.toString()).slice(1).toLowerCase());
          } catch (err) {
            console.error(err);
            OverlayToaster.create().show({
              message: (err as Error).message,
              intent: Intent.DANGER,
            });
          } finally {
            setLoadingCode(false);
          }
          break;
      }
    },
    [fullName, packageJson, selected]
  );

  if (loadingMeta) {
    return (
      <div style={{ ...centerStyles, height: "100vh" }}>
        <Spinner />
      </div>
    );
  }

  if (!meta) return null;

  const files = convertMetaToTreeNode(meta).childNodes;
  if (!files) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Navbar style={{ height: HEADER_HEIGHT }}>
        <NavbarGroup style={{ height: HEADER_HEIGHT }}>
          <Button
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            {packageJson.name}@{packageJson.version}
          </Button>

          <Dialog
            isOpen={dialogOpen}
            title="Select package"
            icon="info-sign"
            onClose={() => {
              setDialogOpen(false);
            }}
          >
            <div className={Classes.DIALOG_BODY}>
              <Entry
                afterChange={() => {
                  setDialogOpen(false);
                }}
              />
            </div>
          </Dialog>

          <NavbarDivider />
          <a
            href={`https://www.npmjs.com/package/${packageJson.name}/v/${packageJson.version}`}
          >
            npm
          </a>

          {packageJson.homepage && (
            <>
              <NavbarDivider />
              <a href={packageJson.homepage}>homepage</a>
            </>
          )}

          {packageJson.repository && (
            <>
              <NavbarDivider />
              <a href={getRepositoryUrl(packageJson.repository)}>repository</a>
            </>
          )}

          {packageJson.license && (
            <>
              <NavbarDivider />
              <div>{packageJson.license}</div>
            </>
          )}

          {packageJson.description && (
            <>
              <NavbarDivider />
              <div>{packageJson.description}</div>
            </>
          )}
        </NavbarGroup>
        <NavbarGroup
          align="right"
          style={{ height: HEADER_HEIGHT, fontSize: 0 }}
        >
          <GitHubButton
            href="https://github.com/pd4d10/npmview"
            aria-label="Star pd4d10/npmview on GitHub"
            data-icon="octicon-star"
            data-show-count
            data-size="large"
          >
            Star
          </GitHubButton>
        </NavbarGroup>
      </Navbar>
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
        }}
      >
        <div
          style={{
            flexBasis: 300,
            flexShrink: 0,
            overflow: "auto",
            paddingTop: 5,
          }}
        >
          <Tree
            contents={files}
            onNodeClick={handleClick}
            onNodeExpand={handleClick}
            onNodeCollapse={handleClick}
          />
        </div>
        <Divider />
        <div style={{ flexGrow: 1, overflow: "auto" }}>
          {loadingCode ? (
            <div style={{ ...centerStyles, height: "100%" }}>
              <Spinner />
            </div>
          ) : (
            <Preview code={code!} lang={ext} />
          )}
        </div>
      </div>
    </div>
  );
};
