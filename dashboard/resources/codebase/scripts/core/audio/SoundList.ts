import { _decorator, AudioClip, Component, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass("SoundList")
export class SoundList extends Component {
  @property(AudioClip)
  clips: AudioClip[] = [];
  protected onLoad(): void {
  }
}
