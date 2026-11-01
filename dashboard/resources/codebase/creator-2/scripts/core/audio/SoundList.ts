const { ccclass, property } = cc._decorator;

@ccclass("SoundList")
export class SoundList extends cc.Component {
  @property(cc.AudioClip)
  clips: cc.AudioClip[] = [];
  protected onLoad(): void {
  }
}
