// @ts-expect-error refractor v3 has no type declarations
import refractor from "refractor";
// @ts-expect-error refractor v3 has no type declarations
import css from "refractor/lang/css";
// @ts-expect-error refractor v3 has no type declarations
import scss from "refractor/lang/scss";
// @ts-expect-error refractor v3 has no type declarations
import less from "refractor/lang/less";
// @ts-expect-error refractor v3 has no type declarations
import javascript from "refractor/lang/javascript";
// @ts-expect-error refractor v3 has no type declarations
import typescript from "refractor/lang/typescript";
// @ts-expect-error refractor v3 has no type declarations
import jsx from "refractor/lang/jsx";
// @ts-expect-error refractor v3 has no type declarations
import tsx from "refractor/lang/tsx";
// @ts-expect-error refractor v3 has no type declarations
import python from "refractor/lang/python";
// @ts-expect-error refractor v3 has no type declarations
import go from "refractor/lang/go";
// @ts-expect-error refractor v3 has no type declarations
import rust from "refractor/lang/rust";
// @ts-expect-error refractor v3 has no type declarations
import json from "refractor/lang/json";
// @ts-expect-error refractor v3 has no type declarations
import markup from "refractor/lang/markup";
// @ts-expect-error refractor v3 has no type declarations
import markdown from "refractor/lang/markdown";
// @ts-expect-error refractor v3 has no type declarations
import yaml from "refractor/lang/yaml";
// @ts-expect-error refractor v3 has no type declarations
import bash from "refractor/lang/bash";
// @ts-expect-error refractor v3 has no type declarations
import sql from "refractor/lang/sql";
// @ts-expect-error refractor v3 has no type declarations
import protobuf from "refractor/lang/protobuf";
// @ts-expect-error refractor v3 has no type declarations
import graphql from "refractor/lang/graphql";
// @ts-expect-error refractor v3 has no type declarations
import docker from "refractor/lang/docker";
// @ts-expect-error refractor v3 has no type declarations
import toml from "refractor/lang/toml";
// @ts-expect-error refractor v3 has no type declarations
import java from "refractor/lang/java";
// @ts-expect-error refractor v3 has no type declarations
import c from "refractor/lang/c";
// @ts-expect-error refractor v3 has no type declarations
import cpp from "refractor/lang/cpp";
// @ts-expect-error refractor v3 has no type declarations
import ruby from "refractor/lang/ruby";
// @ts-expect-error refractor v3 has no type declarations
import php from "refractor/lang/php";
// @ts-expect-error refractor v3 has no type declarations
import swift from "refractor/lang/swift";
// @ts-expect-error refractor v3 has no type declarations
import kotlin from "refractor/lang/kotlin";

refractor.register(css);
refractor.register(scss);
refractor.register(less);
refractor.register(javascript);
refractor.register(typescript);
refractor.register(jsx);
refractor.register(tsx);
refractor.register(python);
refractor.register(go);
refractor.register(rust);
refractor.register(json);
refractor.register(markup);
refractor.register(markdown);
refractor.register(yaml);
refractor.register(bash);
refractor.register(sql);
refractor.register(protobuf);
refractor.register(graphql);
refractor.register(docker);
refractor.register(toml);
refractor.register(java);
refractor.register(c);
refractor.register(cpp);
refractor.register(ruby);
refractor.register(php);
refractor.register(swift);
refractor.register(kotlin);

export { refractor };

export function getLanguage(fileName: string): string {
  const base = fileName.split("/").pop() ?? fileName;
  if (base.toLowerCase().startsWith("dockerfile")) {
    return "docker";
  }
  const ext = base.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    go: "go",
    rs: "rust",
    json: "json",
    css: "css",
    scss: "scss",
    less: "less",
    html: "markup",
    xml: "markup",
    svg: "markup",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    sql: "sql",
    proto: "protobuf",
    graphql: "graphql",
    gql: "graphql",
    toml: "toml",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cc: "cpp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
  };
  return map[ext] ?? "text";
}
