import type { Boat3D as Boat3DImplementation } from "./boat3dImpl";

type Implementation = Boat3DImplementation;

let uiPref = true;
type ImplementationModule = typeof import("./boat3dImpl");
let implementationModule: Promise<ImplementationModule> | null = null;
function loadImplementation(): Promise<ImplementationModule> {
  if (!implementationModule) {
    implementationModule = import("./boat3dImpl").catch((error: unknown) => {
      implementationModule = null;
      throw error;
    });
  }
  return implementationModule;
}
/** Preference shared by the gameplay adapter and optional boat previews. */
export const setBoat3dPref = (enabled: boolean) => { uiPref = enabled; };
export const getBoat3dPref = () => uiPref;

/**
 * Lightweight bridge: the heavy three.js renderer is fetched only when 3D is enabled.
 * If its optional chunk is unavailable offline, the caller keeps drawing the 2D boat.
 */
export class Boat3D {
  private implementation: Implementation | null = null;
  private loading: Promise<void> | null = null;
  private failed = false;
  private retryAfter = 0;
  private enabled = false;

  setEnabled(enabled: boolean) {
    if (enabled && !this.enabled) this.failed = false;
    this.enabled = enabled;
    if (enabled) void this.ensureLoaded();
    this.implementation?.setEnabled(enabled);
  }

  draw(...args: Parameters<Implementation["draw"]>): ReturnType<Implementation["draw"]> {
    if (!this.implementation) {
      if (this.enabled) void this.ensureLoaded();
      return null;
    }
    return this.implementation.draw(...args);
  }

  dispose() {
    this.implementation?.dispose();
  }

  private ensureLoaded(): Promise<void> {
    if (this.implementation || this.loading) return this.loading ?? Promise.resolve();
    if (this.failed && Date.now() < this.retryAfter) return Promise.resolve();
    this.failed = false;
    this.loading = loadImplementation().then(({ Boat3D: Impl }) => {
      this.implementation = new Impl();
      this.implementation.setEnabled(this.enabled);
    }).catch((error: unknown) => {
      this.failed = true;
      this.retryAfter = Date.now() + 5_000;
      console.warn("[3D] дополнительные ресурсы недоступны; остаёмся на 2D-модели", error);
    }).finally(() => {
      this.loading = null;
    });
    return this.loading;
  }
}
