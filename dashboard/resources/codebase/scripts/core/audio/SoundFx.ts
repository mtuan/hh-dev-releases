import { _decorator, AudioClip, AudioSource, Component, Node } from "cc";
import { PooledObject } from "../pool/ObjectPool";
const { ccclass, property } = _decorator;

@ccclass("SoundFx")
export class SoundFx extends Component {
  private audioSource: AudioSource;

  protected onLoad(): void {
    this.audioSource = this.getComponent(AudioSource);
  }

  /// <summary>
  /// Plays the specified audio clip.
  /// </summary>
  /// <param name="clip">The audio clip to play.</param>
  /// <param name="loop">True if the clip should be looped; false otherwise.</param>
  public play(clip: AudioClip, loop: boolean = false) {
    if (clip == null) {
      return;
    }
    this.audioSource.clip = clip;
    this.audioSource.loop = loop;
    this.audioSource.play();
    this.scheduleOnce(this.disableSoundFx.bind(this), clip.getDuration() + 0.1);
  }

  /// <summary>
  /// Returns the sound effect to the sound effects pool.
  /// </summary>
  private disableSoundFx() {
    this.getComponent(PooledObject).pool.returnObject(this.node);
  }
}
