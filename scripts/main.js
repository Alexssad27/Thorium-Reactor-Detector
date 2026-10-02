// Уведомляет о начале строительства ториевого реактора союзником.
// BlockBuildBeginEvent срабатывает в момент размещения ConstructBlock,
// тогда как TileChangeEvent для этой задачи менее надёжен.
Events.on(BlockBuildBeginEvent, event => {
    if (event == null || event.tile == null || event.breaking) return;

    var tile = event.tile;
    var build = tile.build;

    if (!(build instanceof ConstructBlock.ConstructBuild)) return;
    if (build.current !== Blocks.thoriumReactor) return;

    // Команда события — команда строящего блока; сравниваем с локальным игроком.
    if (Vars.player == null || event.team !== Vars.player.team()) return;

    var builderName = Core.bundle.get("reactor-detector.unknown-player");
    if (event.unit != null) {
        // Unit события строительства напрямую связан с игроком, если им управляет игрок.
        var builder = event.unit.getPlayer();
        if (builder != null) builderName = builder.name;
    }

    var distanceText = "";
    var teamData = Vars.state.teams.get(event.team);
    if (teamData != null && teamData.cores != null && !teamData.cores.isEmpty()) {
        // Не передаём JS callback в Seq.min(): у Java Seq есть перегрузки min,
        // и движок скриптов не всегда может выбрать нужный вариант.
        var closestCore = null;
        var closestDistance = Number.MAX_VALUE;
        for (var j = 0; j < teamData.cores.size; j++) {
            var core = teamData.cores.get(j);
            var coreDistance = tile.dst(core);
            if (coreDistance < closestDistance) {
                closestDistance = coreDistance;
                closestCore = core;
            }
        }
        if (closestCore != null) {
            var distance = Math.round(tile.dst(closestCore) / 8);
            var lastTwoDigits = distance % 100;
            var lastDigit = distance % 10;
            var pluralForm = "many";

            if (lastDigit === 1 && lastTwoDigits !== 11) {
                pluralForm = "one";
            } else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
                pluralForm = "few";
            }

            distanceText = Core.bundle.format("reactor-detector.distance." + pluralForm, distance);
        }
    }

    // Ник может содержать собственные цветовые теги; сбрасываем цвет сразу после него.
    var notification = Core.bundle.format("reactor-detector.notification", builderName, tile.x, tile.y, distanceText);
    var chatMessage = Core.bundle.format("reactor-detector.chat", builderName, distanceText);

    // Toast является системным уведомлением HUD и показывается сразу при начале стройки.
    Vars.ui.hudfrag.showToast("[scarlet]⚠ [white]" + notification);
    Vars.ui.chatfrag.addMessage("[accent][" + Core.bundle.get("reactor-detector.chat-prefix") + "] [white]" + chatMessage);
});
