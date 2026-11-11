import { segment } from "../api";
import type { IntegrationSchema } from "../app-types";
import { ACCOUNT_SESSION_REQUIRED, ACCOUNT_SESSION_REQUIRED_ROW } from "../refusals";
import type { HouseholdSettings } from "./ports";
export function createIntegrationSettings(options: HouseholdSettings) {
    const { request: call, mayWrite: mayWriteHousehold, prompt: edit, notify } = options;
    const { open: openOverlay, close: closeOverlay } = options.dialogs;
    async function loadIntegrations(signal: AbortSignal) {
        const write = await mayWriteHousehold();
        const value = await call<{
            revision: number;
            schemas: IntegrationSchema[];
        }>(options.path("/source-integrations"), "GET", undefined, signal);
        return value.schemas
            .filter((schema) => schema.runtime_enabled && schema.state !== "Unavailable")
            .map((schema) => ({
            id: schema.plugin_id,
            label: schema.name,
            value: schema.state === "Ready" ? "Connected" : write ? "Set up" : "",
            // Saving or removing an integration is an account-owner write; the
            // TV only reads it. Saying so beats a form that cannot save.
            description: write
                ? schema.saved_provider_count
                    ? `${schema.saved_provider_count} providers`
                    : undefined
                : ACCOUNT_SESSION_REQUIRED_ROW,
            run: write
                ? () => integrationForm(schema, value.revision)
                : () => notify(ACCOUNT_SESSION_REQUIRED),
        }));
    }
    function integrationForm(schema: IntegrationSchema, revision: number) {
        const draft: Record<string, string | string[]> = {};
        const openForm = () => openOverlay({
            kind: "choices",
            title: schema.name,
            items: [
                ...schema.credential_fields.map((field) => ({
                    id: field.id,
                    label: field.label,
                    value: draft[field.id]
                        ? "Entered"
                        : schema.state === "Ready"
                            ? "Saved"
                            : "",
                    run: () => edit(field.label, async (value) => {
                        draft[field.id] = value;
                        openForm();
                    }, "", field.secret),
                })),
                ...(schema.provider_choices.length
                    ? [
                        {
                            id: "providers",
                            label: "Providers",
                            value: `${(draft.providers as string[] | undefined)?.length ?? schema.saved_provider_count ?? 0} selected`,
                            run: () => openOverlay({
                                kind: "choices",
                                title: "Providers",
                                items: [
                                    ...schema.provider_choices.map((provider) => ({
                                        id: provider.id,
                                        label: provider.label,
                                        value: (draft.providers as string[] | undefined)?.includes(provider.id)
                                            ? "✓"
                                            : "",
                                        run: () => {
                                            const selected = (draft.providers as string[] | undefined) ?? [];
                                            draft.providers = selected.includes(provider.id)
                                                ? selected.filter((id) => id !== provider.id)
                                                : [...selected, provider.id].slice(-schema.maximum_providers);
                                            openForm();
                                        },
                                    })),
                                    { id: "done", label: "Done", run: openForm },
                                ],
                            }),
                        },
                    ]
                    : []),
                {
                    id: "save",
                    label: "Save",
                    run: async () => {
                        await call(options.path("/source-integrations"), "PUT", {
                            revision,
                            plugin_id: schema.plugin_id,
                            configuration: draft,
                        });
                        closeOverlay();
                        await options.reload();
                    },
                },
                ...(schema.connection_id
                    ? [
                        {
                            id: "remove",
                            label: "Remove integration",
                            run: () => openOverlay({
                                kind: "confirm",
                                title: `Remove ${schema.name}?`,
                                items: [
                                    { id: "cancel", label: "Cancel", run: openForm },
                                    {
                                        id: "remove",
                                        label: "Remove",
                                        run: async () => {
                                            await call(options.path(`/source-integrations/${segment(schema.connection_id!)}?revision=${revision}`), "DELETE");
                                            closeOverlay();
                                            await options.reload();
                                        },
                                    },
                                ],
                            }),
                        },
                    ]
                    : []),
            ],
        });
        openForm();
    }
    return loadIntegrations;
}
