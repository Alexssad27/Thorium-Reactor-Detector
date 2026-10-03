// Sensitivity is stored as a string in local client settings; it is never sent over the network.
var sensitivityKey = "reactor-detector.sensitivity.mode";
var sensitivityModeKeys = [
    "reactor-detector.sensitivity.maximum",
    "reactor-detector.sensitivity.everyone-except-self",
    "reactor-detector.sensitivity.allies",
    "reactor-detector.sensitivity.enemies",
    "reactor-detector.sensitivity.self"
];
var sensitivityDescriptionKeys = [
    "reactor-detector.sensitivity.maximum.description",
    "reactor-detector.sensitivity.everyone-except-self.description",
    "reactor-detector.sensitivity.allies.description",
    "reactor-detector.sensitivity.enemies.description",
    "reactor-detector.sensitivity.self.description"
];

function sensitivityLabel(mode){
    if (mode < 0 || mode >= sensitivityModeKeys.length) mode = 2;
    return Core.bundle.get(sensitivityModeKeys[mode]);
}

function currentSensitivity(){
    var mode = parseInt(Core.settings.getString(sensitivityKey, "2"), 10);
    if (isNaN(mode) || mode < 0 || mode >= sensitivityModeKeys.length) return 2;
    return mode;
}

function openSensitivityDialog(labelButton){
    var dialog = new BaseDialog(Core.bundle.get("reactor-detector.sensitivity.title"));
    dialog.cont.pane(function(pane){
        pane.defaults().growX().height(54).pad(4);
        for (var i = 0; i < sensitivityModeKeys.length; i++){
            (function(mode){
                var optionLabel = sensitivityLabel(mode);
                var optionButton = pane.button(optionLabel, Styles.flatTogglet, function(){
                    Core.settings.put(sensitivityKey, String(mode));
                    labelButton.getLabel().setText(optionLabel);
                    dialog.hide();
                }).checked(currentSensitivity() === mode).get();
                Vars.ui.addDescTooltip(optionButton, Core.bundle.get(sensitivityDescriptionKeys[mode]));
                pane.row();
            })(i);
        }
    }).width(Math.min(620, Core.graphics.getWidth() / 1.2));
    dialog.addCloseButton();
    dialog.show();
}

// Register the settings page after the client UI has finished loading.
// Registering while the script files are still being evaluated can happen before
// the settings dialog exists, which leaves the mod's category invisible.
Core.settings.defaults(sensitivityKey, "2");
Events.on(ClientLoadEvent, function(){
    var categoryIcon = Icon.settings;
    var loadedMod = Vars.mods.getMod("reactor-detector");
    if (loadedMod != null && loadedMod.iconTexture != null){
        categoryIcon = new TextureRegionDrawable(new TextureRegion(loadedMod.iconTexture));
    }

    Vars.ui.settings.addCategory("Thorium Reactor Detector", categoryIcon, function(table){
        table.add(Core.bundle.get("reactor-detector.sensitivity.title")).left().growX().pad(8);
        var selector = table.button(sensitivityLabel(currentSensitivity()), Styles.flatTogglet, function(){
            openSensitivityDialog(selector);
        }).width(Math.min(620, Core.graphics.getWidth() / 1.2)).height(54).pad(8).get();
        table.row();
        table.button(Core.bundle.get("reactor-detector.sensitivity.reset"), Styles.flatTogglet, function(){
            Core.settings.put(sensitivityKey, "2");
            selector.getLabel().setText(sensitivityLabel(2));
        }).width(260).height(48).pad(8).left();
    });
});

// BlockBuildBeginEvent fires as soon as the ConstructBlock is placed,
// so notifications are shown at the start of construction on each client.
Events.on(BlockBuildBeginEvent, function(event){
    if (event == null || event.tile == null || event.breaking || Vars.player == null) return;

    var tile = event.tile;
    var build = tile.build;
    if (!(build instanceof ConstructBlock.ConstructBuild)) return;
    if (build.current !== Blocks.thoriumReactor) return;

    var builderPlayer = null;
    if (event.unit != null){
        builderPlayer = event.unit.getPlayer();
    }

    var isSelf = builderPlayer != null && builderPlayer === Vars.player;
    if (!isSelf && event.unit != null){
        var localUnit = Vars.player.unit();
        if (localUnit != null) isSelf = event.unit === localUnit;
    }
    var isAlly = event.team === Vars.player.team();
    var mode = currentSensitivity();
    var showNotification = false;

    if (mode === 0){
        showNotification = true;
    }else if (mode === 1){
        showNotification = !isSelf;
    }else if (mode === 2){
        showNotification = isAlly && !isSelf;
    }else if (mode === 3){
        showNotification = !isAlly;
    }else if (mode === 4){
        showNotification = isSelf;
    }else{
        // Invalid saved value: use the default, allies other than yourself.
        showNotification = isAlly && !isSelf;
    }
    if (!showNotification) return;

    var builderName = Core.bundle.get("reactor-detector.unknown-player");
    if (builderPlayer != null) builderName = builderPlayer.name;

    var distanceText = "";
    var teamData = Vars.state.teams.get(event.team);
    if (teamData != null && teamData.cores != null && !teamData.cores.isEmpty()){
        // Avoid Seq.min(callback): Java overload resolution can crash the JS engine.
        var closestCore = null;
        var closestDistance = Number.MAX_VALUE;
        for (var j = 0; j < teamData.cores.size; j++){
            var core = teamData.cores.get(j);
            var coreDistance = tile.dst(core);
            if (coreDistance < closestDistance){
                closestDistance = coreDistance;
                closestCore = core;
            }
        }
        if (closestCore != null){
            var distance = Math.round(tile.dst(closestCore) / 8);
            var lastTwoDigits = distance % 100;
            var lastDigit = distance % 10;
            var pluralForm = "many";
            if (lastDigit === 1 && lastTwoDigits !== 11){
                pluralForm = "one";
            }else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)){
                pluralForm = "few";
            }
            distanceText = Core.bundle.format("reactor-detector.distance." + pluralForm, distance);
        }
    }

    // Reset markup after the player's colored name to keep the body text readable.
    var notification = Core.bundle.format("reactor-detector.notification", builderName, tile.x, tile.y, distanceText);
    var chatMessage = Core.bundle.format("reactor-detector.chat", builderName, distanceText);
    Vars.ui.hudfrag.showToast("[scarlet]⚠ [white]" + notification);
    Vars.ui.chatfrag.addMessage("[accent][" + Core.bundle.get("reactor-detector.chat-prefix") + "] [white]" + chatMessage);
});
