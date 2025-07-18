import type { ReactNode } from "react"
import clsx from "clsx"
import Link from "@docusaurus/Link"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import Layout from "@theme/Layout"
import Heading from "@theme/Heading"

import styles from "./index.module.css"

function HomepageHeader() {
    const { siteConfig } = useDocusaurusContext()
    const HeadingComponent = Heading as any
    return (
        <header className={clsx("hero hero--primary", styles.heroBanner)}>
            <div className="container">
                <HeadingComponent as="h1" className="hero__title">
                    {siteConfig.tagline}
                </HeadingComponent>
                <p className="hero__subtitle">開発者ポータル</p>
            </div>
        </header>
    )
}

export default function Home(): JSX.Element {
    const { siteConfig } = useDocusaurusContext()
    const LayoutComponent = Layout as any

    // DocusaurusのcustomFieldsからビルド時刻を取得
    const buildDate = (siteConfig.customFields?.buildDate as string) || new Date().toISOString()
    const formattedBuildDate = new Date(buildDate).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
    })

    return (
        <LayoutComponent title={`${siteConfig.title}`} description="Description will go into a meta tag in <head />">
            <HomepageHeader />
            <main>
                <img src="/img/chip-in-v2.drawio.svg" alt="Chip-in" className={styles.bousaiImage} />
                <div className={styles.buildInfo}>Build: {formattedBuildDate}</div>
            </main>
        </LayoutComponent>
    )
}
