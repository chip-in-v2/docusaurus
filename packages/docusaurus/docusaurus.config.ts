import { themes as prismThemes } from "prism-react-renderer"
import type { Config } from "@docusaurus/types"
import type * as Preset from "@docusaurus/preset-classic"
import type { NavbarItem } from "@docusaurus/theme-common"
import simplePlantUML from "@akebifiky/remark-simple-plantuml"
import sidebars from "./sidebars"
import type * as Redocusaurus from "redocusaurus"

const originalItems: Array<NavbarItem> = [
    {
        type: "docSidebar",
        sidebarId: "devGuide",
        position: "left",
        label: "開発者ガイド",
    },
    {
        type: "docSidebar",
        sidebarId: "devDesign",
        position: "left",
        label: "設計書",
    },
    {
        type: "docSidebar",
        sidebarId: "devSpecification",
        position: "left",
        label: "仕様書/テスト項目書",
    },
    {
        type: "docSidebar",
        sidebarId: "adminGuide",
        position: "left",
        label: "管理者マニュアル",
    },
    {
        type: "docSidebar",
        sidebarId: "userGuide",
        position: "left",
        label: "利用者マニュアル",
    },
    {
        href: "https://github.com/orgs/chip-in-v2/repositories",
        label: "GitHub",
        position: "right",
    },
]

// sidebars のキーのリストを取得
const sidebarIds = Object.keys(sidebars)

// sidebarId が sidebars に含まれるものだけをフィルタリング
const filteredItems = originalItems.filter((item) => {
    if (item.type === "docSidebar") {
        return sidebarIds.includes(item.sidebarId as string)
    }
    return true // docSidebar 以外のアイテムはそのまま残す
})

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
    title: "Chip-in V2",
    tagline: "マイクロサービス基盤",
    favicon: "img/favicon.ico",

    // Set the production url of your site here
    url: "https://chip-in-v2.github.io",
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: "/",

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: "chip-in-v2", // Usually your GitHub org/user name.
    projectName: "chip-in-v2", // Usually your repo name.

    onBrokenLinks: "throw",
    onBrokenMarkdownLinks: "warn",

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: "ja",
        locales: ["ja"],
    },

    // カスタムフィールドでビルド時刻を埋め込み
    customFields: {
        buildDate: process.env.BUILD_DATE || new Date().toISOString(),
    },

    presets: [
        [
            "@docusaurus/preset-classic",
            {
                docs: {
                    path: process.env.OPS_FRONTIER_DOCS_PATH || "docs",
                    sidebarPath: "./sidebars.ts",
                    remarkPlugins: [[simplePlantUML, { baseUrl: "https://www.plantuml.com/plantuml/svg" }]],
                },
                blog: false,
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } as any,
        ],
        // Redocusaurus config
        [
            "redocusaurus",
            {
                openapi: {
                    // Folder to scan for *.openapi.yaml files
                    path: "../openapi",
                    routeBasePath: "/api",
                },
                // Theme Options for modifying how redoc renders them
                theme: {
                    // Change with your site colors
                    primaryColor: "#1890ff",
                },
            },
        ] satisfies Redocusaurus.PresetEntry,
    ],

    themeConfig: {
        // Replace with your project's social card
        image: "img/devsecops.svg",
        navbar: {
            title: "",
            logo: {
                alt: "Chip-in Logo",
                src: "img/chip-in-logo-text.png",
            },
            items: filteredItems,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
}

export default config
