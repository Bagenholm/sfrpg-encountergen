Hooks.once('init', async function() {

});

Hooks.once('ready', async function() {
    console.log('sfrpg-encountergen | SFRPG-encountergen active');
});

Hooks.on("changeSidebarTab", async (app, html) => {
    if (app.id == "actors") {
        SfrpgEncountergenConfig.loadButton();
    }
});

Hooks.on("renderSidebarTab", async (app, html) => {
    if (app.options.id == "actors") {
        SfrpgEncountergenConfig.loadButton();
    }
});


Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
    registerPackageDebugFlag(SfrpgEncountergen.ID);
});

//Hooks.on("renderTokenHUD", (...args) => TempGen.tokenIcon(...args));

class SfrpgEncountergen {
    static ID = 'sfrpg-encountergen';
    static TEMPLATE = `modules/${this.ID}/templates/sfrpg-encountergen.hbs`
    static log(force, ...args) {  
        const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

        if (shouldLog) {
            console.log(this.ID, '|', ...args);
        }
    }
}

class SfrpgEncountergenForm extends FormApplication {
    static get defaultOptions() {
        const defaults = super.defaultOptions;

        const overrides = {
            template: SfrpgEncountergen.TEMPLATE,
            height: 'auto',
            width: '800',
            submitOnChange: true,
            closeOnSubmit: false,
            resizable: true,
            apl: 1,
            difficulty: SfrpgEncountergenConfig.difficulty,
        }

        const mergedOptions = foundry.utils.mergeObject(defaults, overrides);

        return mergedOptions;
    }

    getData(options) {
        return {"options": options, "encounter": SfrpgEncountergenData.ENCOUNTER};
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on('click', "[data-action]", this._handleButtonClick.bind(this));
    }

    async _handleButtonClick(event) {
        const clickedElement = $(event.currentTarget);
        const action = clickedElement.data().action;

        switch (action) {
            case 'new': {
                SfrpgEncountergenData.ENCOUNTER = SfrpgEncountergenData.getRandomEncounterByCr(SfrpgEncountergenData.TARGET_CR);
                this.render();
                break;
            }

            case 'import': {
                let importedActors = [];

                SfrpgEncountergenData.ENCOUNTER.forEach((doc) => 
                    game.packs.get("sfrpg.alien-archives").getDocument(doc._id).then((actor) => Actor.create(actor))
                );

                break;
            }

            case 'reroll': {
                let index = clickedElement.parents('[data-alien-index]')?.data().alienIndex;
                let cr = SfrpgEncountergenData.ENCOUNTER[index]?.system.details.cr;
                let newAlien = SfrpgEncountergenData.getSingleEnemyByCr(cr);

                SfrpgEncountergenData.ENCOUNTER[index] = newAlien;


                this.render();
                break;
            }

            case 'rendersheet': {
                let index = clickedElement.parents('[data-alien-index]')?.data().alienIndex;
                let alienId = SfrpgEncountergenData.ENCOUNTER[index]._id;
                game.packs.get("sfrpg.alien-archives").getDocument(alienId).then((actor) => actor.sheet.render(true));
            }
        }
        
        return this.render();
    }

    async _updateObject(event, formData) {
        this.options.apl = formData.apl;
        this.options.difficulty = formData.difficultymod;
        let targetCr = parseInt(formData.difficultymod) + parseInt(formData.apl);
        if(Number.isInteger(targetCr)) {
            SfrpgEncountergenData.TARGET_CR = parseInt(formData.difficultymod) + parseInt(formData.apl);
        }
    } 
}

class SfrpgEncountergenConfig {
     static loadButton() {
        if (!game.user.isGM && !Actor.canUserCreate(game.user)) {
            return;
        }

        let encgenButton = document.getElementById("encgen-button");
        if (encgenButton != null) {
            return;
        }

        encgenButton = this.createButton();

        $(encgenButton).click((event) => {
            SfrpgEncountergenData.indexArchive();    
            new SfrpgEncountergenForm().render(true);
        });

        const actorsPanel = document.getElementById("actors");
        const actorFooter = actorsPanel.getElementsByClassName("directory-footer")[0];
        const createEntityButton = actorFooter.getElementsByClassName("create-entity")[0];
        actorFooter.insertBefore(encgenButton, createEntityButton);

      }

      static createButton() {
          let button = document.createElement('button');
          button.innerHTML = `<i id="encgen-button" class="fas fa-child"></i>Generate encounter`;
          button.classList.add('control-icon');

          return button;
      }
}

class SfrpgEncountergenData {

    static INDEXED_ARCHIVE = "";
    static ENCOUNTER = [];
    static TARGET_CR = 0;

    /**
     * 
     * @param {int the wanted encounter CR} encounterCr 
     * @returns {Array with the encounter actors' CR, e. g. [4, 2, 2]}
     */
    static getEnemySpread(encounterCr) { 
        let combinations = this.getCrSpread(encounterCr);

        return this.getRandomIndexFromArray(combinations)
    }

    /**
     * 
     * @param {The wanted encounter CR} encounterCr 
     * @returns {Spread of possible combinations of NPC CRs}
     */
    static getCrSpread(encounterCr) {
        let combinations = [];

        if(encounterCr > 5) {    
            if (encounterCr % 2 == 0) {
                //possible combinations when encounter CR is even
                combinations = [
                    //example XP when starting at CR6
                    //cr = 2400
                    //-1 = 1600
                    //-2 = 1200
                    //-3 = 800
                    //-4 = 600
                    //-5 = 400
                    [encounterCr],
                    [encounterCr - 1, encounterCr - 3],
                    [encounterCr - 1, encounterCr - 5, encounterCr - 5],
                    [encounterCr - 2, encounterCr - 2],
                    [encounterCr - 2, encounterCr - 3, encounterCr - 5],
                    [encounterCr - 2, encounterCr - 4, encounterCr - 4],
                    [encounterCr - 2, encounterCr - 5, encounterCr - 5, encounterCr - 5],
                    [encounterCr - 3, encounterCr - 3, encounterCr - 5, encounterCr - 5],
                    [encounterCr - 3, encounterCr - 5, encounterCr - 5, encounterCr - 5, encounterCr - 5],
                    [encounterCr - 4, encounterCr - 4, encounterCr - 4, encounterCr - 4],
                    [encounterCr - 4, encounterCr - 4, encounterCr - 5, encounterCr - 5, encounterCr - 5, encounterCr - 5] //600 600 400 400 400 400
                ]; //600 600 400 400 400
            } else {
                //possible combinations when encounter CR is odd
                combinations = [
                    //example XP when starting at CR7
                    //cr = 3200
                    //-1 = 2400
                    //-2 = 1600
                    //-3 = 1200
                    //-4 = 800
                    //-5 = 600
                    [encounterCr],
                    [encounterCr - 1, encounterCr - 4],
                    [encounterCr - 2, encounterCr - 2],
                    [encounterCr - 2, encounterCr - 4, encounterCr - 4],
                    [encounterCr - 3, encounterCr - 3, encounterCr - 4],
                    [encounterCr - 4, encounterCr - 4, encounterCr - 4, encounterCr - 4],
                    [encounterCr - 5, encounterCr - 5, encounterCr - 5, encounterCr - 5, encounterCr - 5, encounterCr - 5] //600 600 600 600 600 600
                ];
            }
        } else if(encounterCr == 5) {
            combinations = [
                [encounterCr],
                [encounterCr - 1, encounterCr - 4],
                [encounterCr - 2, encounterCr - 2],
                [encounterCr - 2, encounterCr - 4, encounterCr - 4],
                [encounterCr - 3, encounterCr - 3, encounterCr - 4],
                [encounterCr - 4, encounterCr - 4, encounterCr - 4, encounterCr - 4],
                [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
            ]
        } else if(encounterCr == 4) {
            combinations = [
                [encounterCr],
                [encounterCr - 1, encounterCr - 3],
                [encounterCr - 1, 1/3, 1/3],
                [encounterCr - 2, encounterCr - 2],
                [encounterCr - 2, encounterCr - 3, 1/3],
                [encounterCr - 2, 0.5, 0.5],
                [encounterCr - 2, 1/3, 1/3, 1/3],
                [encounterCr - 3, encounterCr - 3, 1/3, 1/3],
                [encounterCr - 3, 1/3, 1/3, 1/3, 1/3],
                [0.5, 0.5, 0.5, 0.5],
                [0.5, 0.5, 1/3, 1/3, 1/3, 1/3]
            ]
        } else if(encounterCr == 3) {
            combinations = [
                [encounterCr],
                [encounterCr - 1, 1/3],
                [encounterCr - 2, encounterCr - 2],
                [encounterCr - 2, 1/3, 1/3],
                [0.5, 0.5, 1/3],
                [1/3, 1/3, 1/3, 1/3]
            ]
        } else if(encounterCr == 2) {
            combinations = [
                [encounterCr],
                [encounterCr - 1, 1/3],
                [0.5, 0.5],
            ]
        } else if(encounterCr == 1) {
            combinations = [
                [encounterCr],
                [0.5, 1/3],
                [1/3, 1/3]
            ]
        } else if(encounterCr == 0) {
            combinations = [
                [0.5],
                [1/3, 1/3]
            ]
        }
        return combinations;
    }

    static getRandomIndexFromArray(array) {
        let index = Math.floor(Math.random() * array.length);
        return array[index];
    }

    static getRandomEncounterByCr(cr) {
        let spread = this.getEnemySpread(cr);
        let randomEncounter = [];

        spread.forEach((entry) => randomEncounter.push(this.getRandomIndexFromArray(this.filterIndexByCr(entry))));

        return randomEncounter;
    }

    static filterIndexByCr(cr) {
        let filtered = this.INDEXED_ARCHIVE.filter((alien) => alien.system?.details.cr == cr);
        return filtered;
    }

    static getSingleEnemyByCr(cr) {
        return this.getRandomIndexFromArray(this.filterIndexByCr(cr));
    }

    static indexArchive() {
        if(SfrpgEncountergenData.INDEXED_ARCHIVE.length == 0) {
            game.packs.get("sfrpg.alien-archives")
                .getIndex({ fields: ["name", 
                                    "system.details.type", 
                                    "system.details.cr", 
                                    "system.details.environment", 
                                    "system.details.organization", 
                                    "img", 
                                    "system.items"] })
                .then((resp) => SfrpgEncountergenData.INDEXED_ARCHIVE = resp, () => SfrpgEncountergen.log(true, 'Error reading the Alien Archive compendium'));
        }
    }

    static calcApl(levels) {
        let sum = 0;
        for (let i = 0; i < levels.length; i++) {
            sum += levels[i]
        }
        if(levels.length >= 6) {
            sum++;
        } else if (levels.length <= 2) {
            sum--;
        }

        return Math.floor(sum / levels.length)
    }
}