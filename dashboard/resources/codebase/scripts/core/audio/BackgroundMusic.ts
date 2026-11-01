import { _decorator, AudioSource, Component, director } from "cc";
const { ccclass, property } = _decorator;

@ccclass("BackgroundMusic")
export default class BackgroundMusic extends Component {
    private static inst: BackgroundMusic = null;

    private audioSource: AudioSource;

    protected onLoad(): void {
        this.audioSource = this.getComponent(AudioSource);
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
