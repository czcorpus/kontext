/**
 * Creates global instance of SoundManager 2 based audio player
 * and defines some related visual control elements (play, pause, stop).
 */
define(['win'], function (win) {
    'use strict';

    var create = function (wrapper, triggerLink) {
        var player;

        if (win.audioPlayer) {
            win.audioPlayer.removeUserInterface();
        }

        player = {

            triggerLink : null,

            wrapper : null,

            playSessionId : null,

            animationTimer : null,

            status : 0, // 0 = stopped, 1 = paused, 2 = playing

            init : function (wrapper, triggerLink) {
                player.triggerLink = typeof triggerLink === 'string' ? $(triggerLink) : triggerLink;
                player.wrapper = typeof wrapper === 'string' ? $(wrapper) : wrapper;
                player.playSessionId = player.triggerLink.readAttribute('href');

                if (player.wrapper === null) {
                    player.wrapper = Element.extend(document.createElement('div'));
                    player.wrapper.writeAttribute('id', 'audio-wrapper');
                    player.wrapper.observe('click', function (event) {
                        event.stop();
                    });
                    $(document.body).insert(player.wrapper);
                }
                player.wrapper.setStyle({
                    top : (player.triggerLink.cumulativeOffset()[1] - 25) + 'px',
                    left : (player.triggerLink.cumulativeOffset()[0]) + 'px',
                    height : '48px'
                });
            },

            animatePlayButton : function () {
                var img1,
                    img2,
                    blinkingElement = null;

                clearInterval(player.animationTimer);
                if (player.status === 1) {
                    $('audio-play-button').writeAttribute('class', 'img-button-play');
                    blinkingElement = 'audio-pause-button';
                    img1 = 'img-button-pause';
                    img2 = 'img-button-pause-b';

                } else if (player.status === 2) {
                    $('audio-pause-button').writeAttribute('class', 'img-button-pause');
                    blinkingElement = 'audio-play-button';
                    img1 = 'img-button-play';
                    img2 = 'img-button-play-b';
                }

                if (blinkingElement) {
                    player.animationTimer = setInterval(function () {
                        if ($(blinkingElement).readAttribute('class') === img1) {
                            $(blinkingElement).writeAttribute('class', img2);

                        } else {
                            $(blinkingElement).writeAttribute('class', img1);
                        }
                    }, 500);
                }
            },

            createUserInterface : function () {
                var uiSource;

                uiSource = '<div class="audio-controls">' +
                    '<a id="audio-play-button" class="img-button-play"></a>' +
                    '<a id="audio-pause-button" class="img-button-pause"></a>' +
                    '<a id="audio-stop-button" class="img-button-stop"></a>' +
                    '</div>';

                player.wrapper.update(uiSource);

                $('audio-stop-button').observe('click', function () {
                    soundManager.stop('speech-player');
                    player.removeUserInterface();
                    soundManager.destroySound(player.playSessionId);
                });

                $('audio-pause-button').observe('click', function () {
                    if (player.status === 1) {
                        soundManager.play(player.playSessionId);
                        player.status = 2;

                    } else if (player.status === 2) {
                        soundManager.pause(player.playSessionId);
                        player.status = 1;
                    }
                    player.animatePlayButton();
                });

                $('audio-play-button').observe('click', function () {
                    if (player.status === 0) {
                        soundManager.play(player.playSessionId);
                        player.status = 2;

                    } else if (player.status === 1) {
                        soundManager.play(player.playSessionId);
                        player.status = 2;
                    }
                    player.animatePlayButton();
                });
            },

            removeUserInterface : function () {
                clearInterval(player.animationTimer);
                player.wrapper.update();
            },

            play : function () {
                player.createUserInterface();
                var sound = soundManager.createSound({
                    id: player.playSessionId,
                    url: player.triggerLink.readAttribute('href'),
                    autoLoad: true,
                    autoPlay: false,
                    volume: 90,
                    onload: function (bSuccess) {
                        if (!this.loaded) {
                            clearInterval(player.animationTimer);
                            player.wrapper.update('<div class="audio-controls"><a id="audio-error-confirm">:-(</a></div>');
                            $('audio-error-confirm').observe('click', function () {
                                player.removeUserInterface();
                            });
                        }
                    },
                    onplay : function () {
                    },
                    onstop : function () {
                        player.status = 0;
                    }
                });

                sound.play();
                player.status = 2;
                player.animatePlayButton();
            }
        };
        player.init(wrapper, triggerLink);
        win.audioPlayer = player;
        return win.audioPlayer;
    };

    // API
    return {
        create : create
    };

});