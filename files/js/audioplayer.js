/**
 * This library provides a simple audio-player (play/pause/stop)
 * based on the SoundManager 2 library (http://www.schillmania.com/projects/soundmanager2/)
 * Prototype 1.7+ is also required.
 */
define(['win', 'jquery'], function (win, $) {
    'use strict';

    /**
     * Creates instance of the player as an attribute of the 'win' parameter. If such
     * parameter exists and is non-empty, then current value is replaced by the new one.
     *
     * @param wrapper {string|Element} ID of wrapping HTML element or element itself
     * @param triggerLink {string|Element} ID of link which has been clicked and leads to an audio,
     * or link element itself
     * @param options {object} a key->value object holding some options (currently only 'volume' is accepted)
     * @return {player}
     */
    var create = function (wrapper, triggerLink, options) {
        var player;

        if (win.audioPlayer) {
            win.audioPlayer.removeUserInterface();
        }
        options = options || {};

        /**
         * Object of the player.
         *
         * @type {Object}
         */
        player = {

            PLAYER_STATUS_STOPPED : 0,

            PLAYER_STATUS_PAUSED : 1,

            PLAYER_STATUS_PLAYING : 2,

            /**
             * Defines how fast animated buttons blink (in milliseconds)
             */
            BLINKING_INTERVAL : 500,

            triggerLink : null,

            wrapper : null,

            playSessionId : null,

            animationTimer : null,

            /**
             * Audio volume. Values from 0 to 100 are accepted.
             */
            volume : 100,

            /**
             * status of the player, see PLAYER_STATUS_* constants
             */
            status : 0,

            /**
             *
             * @param wrapper {string|Element} ID of wrapping HTML element or element itself
             * @param triggerLink {string|Element} ID of link which has been clicked and leads to an audio,
             * or link element itself
             */
            init : function (wrapper, triggerLink) {
                player.triggerLink = typeof triggerLink === 'string' ? $(triggerLink) : triggerLink;
                player.wrapper = typeof wrapper === 'string' ? $(wrapper) : wrapper;
                player.playSessionId = $(player.triggerLink).attr('href');

                if (player.wrapper === null) {
                    player.wrapper = document.createElement('div');
                    $(player.wrapper).attr('id', 'audio-wrapper');
                    $(player.wrapper).bind('click', function (event) {
                        event.stopPropagation();
                    });
                    $(document.body).append(player.wrapper);
                }
                $(player.wrapper).css({
                    top : ($(player.triggerLink).position().top - 25) + 'px',
                    left : ($(player.triggerLink).position().left) + 'px',
                    height : '48px'
                });
            },

            /**
             * Animates Play or Pause button according to the state of the player
             * (see PLAYER_STATUS_* constants).
             */
            animateActiveButton : function () {
                var stateClass1,
                    stateClass2,
                    blinkingElement = null;

                clearInterval(player.animationTimer);
                if (player.status === player.PLAYER_STATUS_PAUSED) {
                    $('#audio-play-button').attr('class', 'img-button-play');
                    blinkingElement = 'audio-pause-button';
                    stateClass1 = 'img-button-pause';
                    stateClass2 = 'img-button-pause-b';

                } else if (player.status === player.PLAYER_STATUS_PLAYING) {
                    $('#audio-pause-button').attr('class', 'img-button-pause');
                    blinkingElement = 'audio-play-button';
                    stateClass1 = 'img-button-play';
                    stateClass2 = 'img-button-play-b';
                }

                if (blinkingElement) {
                    player.animationTimer = setInterval(function () {
                        if ($('#' + blinkingElement).attr('class') === stateClass1) {
                            $('#' + blinkingElement).attr('class', stateClass2);

                        } else {
                            $('#' + blinkingElement).attr('class', stateClass1);
                        }
                    }, player.BLINKING_INTERVAL);
                }
            },

            /**
             * Creates simple three-button (play, pause, stop) interface for the player
             * and defines 'click' handlers for the buttons.
             */
            createUserInterface : function () {
                $(player.wrapper).empty().append('<div class="audio-controls">' +
                    '<a id="audio-play-button" class="img-button-play"></a>' +
                    '<a id="audio-pause-button" class="img-button-pause"></a>' +
                    '<a id="audio-stop-button" class="img-button-stop"></a>' +
                    '</div>');

                $('#audio-stop-button').bind('click', function () {
                    soundManager.stopPropagation('speech-player');
                    player.removeUserInterface();
                    soundManager.destroySound(player.playSessionId);
                });

                $('#audio-pause-button').bind('click', function () {
                    if (player.status === player.PLAYER_STATUS_PAUSED) {
                        soundManager.play(player.playSessionId);
                        player.status = player.PLAYER_STATUS_PLAYING;

                    } else if (player.status === player.PLAYER_STATUS_PLAYING) {
                        soundManager.pause(player.playSessionId);
                        player.status = player.PLAYER_STATUS_PAUSED;
                    }
                    player.animateActiveButton();
                });

                $('#audio-play-button').bind('click', function () {
                    if (player.status === player.PLAYER_STATUS_STOPPED) {
                        soundManager.play(player.playSessionId);
                        player.status = player.PLAYER_STATUS_PLAYING;

                    } else if (player.status === player.PLAYER_STATUS_PAUSED) {
                        soundManager.play(player.playSessionId);
                        player.status = player.PLAYER_STATUS_PLAYING;
                    }
                    player.animateActiveButton();
                });
            },

            /**
             * Clears all animations and cleans-up contents of the 'wrapper' element.
             */
            removeUserInterface : function () {
                clearInterval(player.animationTimer);
                $(player.wrapper).empty();
            },

            /**
             * Plays the audio file as specified by the player.triggerLink element.
             */
            play : function () {
                player.createUserInterface();
                var sound = soundManager.createSound({
                    id: player.playSessionId,
                    url: $(player.triggerLink).attr('href'),
                    autoLoad: true,
                    autoPlay: false,
                    volume: player.volume,
                    onload: function (bSuccess) {
                        if (!bSuccess) {
                            clearInterval(player.animationTimer);
                            $(player.wrapper).empty().append('<div class="audio-controls"><a id="audio-error-confirm">:-(</a></div>');
                            $('#audio-error-confirm').bind('click', function () {
                                player.removeUserInterface();
                            });
                        }
                    },
                    onplay : function () {
                    },
                    onfinish : function () {
                        player.status = player.PLAYER_STATUS_STOPPED;
                        player.removeUserInterface();
                    }
                });

                sound.play();
                player.status = player.PLAYER_STATUS_PLAYING;
                player.animateActiveButton();
            }
        };
        player.init(wrapper, triggerLink);
        if (options.hasOwnProperty('volume')) {
            player.volume = options.volume;
        }
        win.audioPlayer = player;
        return win.audioPlayer;
    };

    // API exported for require.js compatible modules
    return {
        create : create
    };

});