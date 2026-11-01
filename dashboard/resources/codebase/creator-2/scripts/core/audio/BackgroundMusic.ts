const { ccclass, property } = cc._decorator;

@ccclass("BackgroundMusic")
export default class BackgroundMusic extends cc.Component {
    private static inst: BackgroundMusic = null;

    private audioSource: cc.AudioSource;

    protected onLoad(): void {
        this.audioSource = this.getComponent(cc.AudioSource);
    }

    play() {
        if (!this.audioSource.clip) return;
        this.audioSource.play();
    }

    pause() {
        if (!this.audioSource.clip) return;
        this.audioSource.pause();
    }

    setVolume(volume: number) {
        this.audioSource.volume = volume;
    }
}
