// Auto-generated TypeScript declarations for XML component import.
// DO NOT EDIT — this file is regenerated during build.
//
// Source component: SolidMotionGroup
// Extends: Group

import type { IGroupProps } from "@roku-sdk/components";
import type { TypedXmlComponent } from "@roku-sdk/interfaces";

interface SolidMotionGroupFields {
    xRequest: Record<string, unknown>;
    yRequest: Record<string, unknown>;
    alphaRequest: Record<string, unknown>;
    xState: Record<string, unknown>;
    yState: Record<string, unknown>;
    alphaState: Record<string, unknown>;
    motionX: number;
    motionY: number;
}

export interface ISolidMotionGroupProps extends IGroupProps, Partial<SolidMotionGroupFields> {}

declare const _default: TypedXmlComponent<"SolidMotionGroup", SolidMotionGroupFields>;
export default _default;

declare module "@roku-sdk/solid" {
    namespace JSX {
        interface IntrinsicElements {
            solidMotionGroup: ISolidMotionGroupProps;
        }
    }
}

declare module "@roku-sdk/solid/jsx-runtime" {
    namespace JSX {
        interface IntrinsicElements {
            solidMotionGroup: ISolidMotionGroupProps;
        }
    }
}

declare module "solid-js" {
    namespace JSX {
        interface IntrinsicElements {
            solidMotionGroup: ISolidMotionGroupProps;
        }
    }
}
