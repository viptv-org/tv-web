// Auto-generated TypeScript declarations for XML component import.
// DO NOT EDIT — this file is regenerated during build.
//
// Source component: ViptvTextDialogBridge
// Extends: Group

import type { IGroupProps } from "@roku-sdk/components";
import type { TypedXmlComponent } from "@roku-sdk/interfaces";

interface ViptvTextDialogBridgeFields {
    request: Record<string, unknown>;
    close: boolean;
    edit: Record<string, unknown>;
    result: Record<string, unknown>;
}

export interface IViptvTextDialogBridgeProps extends IGroupProps, Partial<ViptvTextDialogBridgeFields> {}

declare const _default: TypedXmlComponent<"ViptvTextDialogBridge", ViptvTextDialogBridgeFields>;
export default _default;

declare module "@roku-sdk/solid" {
    namespace JSX {
        interface IntrinsicElements {
            viptvTextDialogBridge: IViptvTextDialogBridgeProps;
        }
    }
}

declare module "@roku-sdk/solid/jsx-runtime" {
    namespace JSX {
        interface IntrinsicElements {
            viptvTextDialogBridge: IViptvTextDialogBridgeProps;
        }
    }
}

declare module "solid-js" {
    namespace JSX {
        interface IntrinsicElements {
            viptvTextDialogBridge: IViptvTextDialogBridgeProps;
        }
    }
}
