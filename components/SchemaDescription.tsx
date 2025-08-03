import React from "react"

interface SchemaDescriptionProps {
    schemaPath: string
    pointer: string
}

export default function SchemaDescription({ schemaPath, pointer }: SchemaDescriptionProps) {
    const [description, setDescription] = React.useState<string>("")

    React.useEffect(() => {
        // JSON Schemaファイルを読み込み、ポインターで指定された箇所のdescriptionを取得
        fetch(schemaPath)
            .then((res) => res.json())
            .then((schema) => {
                const parts = pointer.replace("#/", "").split("/")
                let current = schema

                for (const part of parts) {
                    current = current[part]
                }

                setDescription(current?.description || "")
            })
    }, [schemaPath, pointer])

    return description ? <div className="schema-description">{description}</div> : null
}
