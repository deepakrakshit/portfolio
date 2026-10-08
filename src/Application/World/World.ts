import Application from '../Application';
import Resources from '../Utils/Resources';
import ComputerSetup from './Computer';
import MonitorScreen from './MonitorScreen';
import Environment from './Environment';
import Decor from './Decor';
import Dog from './Dog';
import ToyBone from './ToyBone';
import CoffeeSteam from './CoffeeSteam';
import AudioManager from '../Audio/AudioManager';
import DeskInteractions from './DeskInteractions';
export default class World {
    application: Application;
    scene: THREE.Scene;
    resources: Resources;

    // Objects in the scene
    environment: Environment;
    decor: Decor;
    dog: Dog;
    toyBone: ToyBone;
    computerSetup: ComputerSetup;
    monitorScreen: MonitorScreen;
    coffeeSteam: CoffeeSteam;
    audioManager: AudioManager;
    deskInteractions: DeskInteractions;

    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.resources = this.application.resources;
        // Wait for resources
        this.resources.on('ready', () => {
            // Setup
            this.environment = new Environment();
            this.decor = new Decor();
            this.dog = new Dog();
            this.toyBone = new ToyBone();
            this.computerSetup = new ComputerSetup();
            this.monitorScreen = new MonitorScreen();
            this.coffeeSteam = new CoffeeSteam();
            this.audioManager = new AudioManager();
            this.deskInteractions = new DeskInteractions(this);
        });
    }

    update() {
        if (this.dog) this.dog.update();
        if (this.toyBone) this.toyBone.update();
        if (this.monitorScreen) this.monitorScreen.update();
        if (this.environment) this.environment.update();
        if (this.coffeeSteam) this.coffeeSteam.update();
        if (this.audioManager) this.audioManager.update();
        if (this.deskInteractions) this.deskInteractions.update();
    }
}
