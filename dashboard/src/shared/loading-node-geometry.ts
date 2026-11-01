import type { LoadingDesignerComponent } from '../../electron/types';
import { loadingRuntimeTextHeight, loadingRuntimeTextSize, resolveLoadingRuntimeFrames, type RuntimeLoadingFrame } from '../../resources/loading-kit/runtime/loading-runtime-core';

export type LoadingNodeFrame = RuntimeLoadingFrame;
export function loadingTextNodeHeight(component: LoadingDesignerComponent): number { return loadingRuntimeTextHeight(component); }
export function loadingTextNodeSize(component: LoadingDesignerComponent): { width: number; height: number } { return loadingRuntimeTextSize(component); }
export function resolveLoadingNodeFrames(components: LoadingDesignerComponent[], designWidth: number, designHeight: number): Map<string, LoadingNodeFrame> { return resolveLoadingRuntimeFrames(components, designWidth, designHeight); }
export function applyLoadingNodeFrame(element: HTMLElement, frame: LoadingNodeFrame | undefined, designHeight: number): void { if (!frame) return; element.style.left = `${frame.left}px`; element.style.top = `${designHeight - frame.bottom - frame.height}px`; element.style.width = `${frame.width}px`; element.style.height = `${frame.height}px`; element.style.transformOrigin = `${frame.anchorX * 100}% ${(1 - frame.anchorY) * 100}%`; element.style.transform = `rotate(${-frame.rotation}deg) scale(${frame.scaleX},${frame.scaleY})`; element.style.opacity = String(frame.opacity); }
