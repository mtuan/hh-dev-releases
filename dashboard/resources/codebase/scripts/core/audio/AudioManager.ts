import { AudioClip, AudioSource } from 'cc';
import { AppLifecycle } from '../app/types';
import ObjectPool, { PooledObject } from '../pool/ObjectPool';
import BackgroundMusic from './BackgroundMusic';
import { SoundFx } from './SoundFx';

export type AudioChannel = 'music' | 'sfx';

export class AudioManager implements AppLifecycle {
    private soundPool: ObjectPool;
    private nameToSound: Map<string, AudioClip> = new Map<string, AudioClip>();

    private bgMusic: BackgroundMusic = null;

    private musicVolume = 1;
    private sfxVolume = 1;

    public init(): void {
    }

    public addSounds(soundsToAdd: AudioClip[]) {
        for (let sound of soundsToAdd) {
            this.nameToSound.set(sound.name, sound);
        }
    }

    public removeSounds(soundsToAdd: AudioClip[]) {
        for (let sound of soundsToAdd) {
            this.nameToSound.delete(sound.name);
        }
    }

    public playSfx(id: string, loop: boolean = false): void {
        if (!this.soundStatus) return;
        const clip = this.nameToSound.get(id);
        if (clip != null) {
            this.playAudioClip(clip, loop);
        }
    }

    public playAudioClip(clip: AudioClip, loop: boolean = false) {
        const sound = this.soundStatus;
        if (!sound) {
            return;
        }

        if (clip != null) {
            const node = this.soundPool.getObject();
            const source = node.getComponent(AudioSource);
            if (source) {
                source.volume = this.sfxVolume;
            }
            node.getComponent(SoundFx).play(clip, loop);
        }
    }

    public playMusic(id: string, loop = true): void {
        if (this.musicStatus) {
            this.bgMusic.setVolume(this.musicVolume);
            this.bgMusic.play();
        }
    }

    public stopMusic(soundName: string): void {
        for (let sound of this.soundPool.getComponentsInChildren(SoundFx)) {
            if (
                sound.getComponent(AudioSource).clip == this.nameToSound.get(soundName)
            ) {
                sound.getComponent(PooledObject).pool.returnObject(sound.node);
            }
        }
    }

    public setVolume(channel: AudioChannel, volume: number): void {
        const clamped = Math.max(0, Math.min(1, volume));

        if (channel === 'music') {
            this.musicVolume = clamped;
            this.bgMusic?.setVolume(clamped);
            return;
        }

        this.sfxVolume = clamped;
        for (const sound of this.soundPool.getComponentsInChildren(SoundFx)) {
            const source = sound.getComponent(AudioSource);
            if (source) {
                source.volume = clamped;
            }
        }
    }

    set soundStatus(isOn: boolean) {
    }

    set musicStatus(isOn: boolean) {
    }

    set vibrateStatus(isOn: boolean) {
    }

    get soundStatus() {
        return true;
    }

    get musicStatus() {
        return true;
    }

    get vibrateStatus() {
        return true;
    }
}
