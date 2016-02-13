/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/**
 * This library provides a simple audio-player (play/pause/stop)
 * based on the SoundManager 2 library (http://www.schillmania.com/projects/soundmanager2/).
 */
define(['win', 'jquery', 'SoundManager'], function (win, $, SoundManager) {
    'use strict';

    var lib = {},
        soundManager = SoundManager.getInstance();

    /**
     * @param wrapper {string|Element} ID of wrapping HTML element or element itself
     * @param triggerLink {string|Element} ID of link which has been clicked and leads to an audio,
     * or link element itself
     * @constructor
     */
    function SpeechPlayer(wrapper, triggerLink) {
        this.PLAYER_STATUS_STOPPED = 0;

        this.PLAYER_STATUS_PAUSED = 1;

        this.PLAYER_STATUS_PLAYING = 2;

        /**
         * Defines how fast animated buttons blink (in milliseconds)
         */
        this.BLINKING_INTERVAL = 500;

        this.triggerLink = null;

        this.wrapper = null;

        this.playSessionId = null;

        this.animationTimer = null;

        /**
         * Audio volume. Values from 0 to 100 are accepted.
         */
        this.volume = 100;

        /**
         * status of the player, see PLAYER_STATUS_* constants
         */
        this.status = 0;

        this.triggerLink = typeof triggerLink === 'string' ? $('#' + triggerLink).get(0) : triggerLink;

        this.itemsToPlay = this.parseSpeechURL($(this.triggerLink).attr('href'));

        this.wrapper = typeof wrapper === 'string' ? $('#' + wrapper).get(0) : wrapper;
        this.playSessionId = $(this.triggerLink).attr('href');

        if (!this.wrapper) {
            this.wrapper = document.createElement('div');
            $(this.wrapper).attr('id', 'audio-wrapper')
                .bind('click', function (event) {
                    event.stopPropagation();
                });
            $(document.body).append(this.wrapper);
        }
        $(this.wrapper).css({
            top: ($(this.triggerLink).offset().top - 25) + 'px',
            left: ($(this.triggerLink).offset().left) + 'px',
            height: '48px'
        });
    }

    /**
     *
     * @param url
     * @returns {Array}
     */
    SpeechPlayer.prototype.parseSpeechURL = function (url) {
        var params = {},
            urlParts,
            items,
            rootUrl,
            ans = [],
            i;

        urlParts = url.split('?');
        rootUrl = urlParts[0];
        items = urlParts[1];

        if (items) {
            $.each(items.split('&'), function (i, v) {
                var pair = v.split('=');
                if (params.hasOwnProperty(pair[0])) {
                    if ($.inArray(pair[1], params[pair[0]]) < 0) {
                        params[pair[0]].push(pair[1]);
                    }

                } else {
                    params[pair[0]] = [pair[1]];
                }
            });
        }
        if (params.hasOwnProperty('chunk')) {
            for (i = 0; i < params.chunk.length; i += 1) {
                ans.push(rootUrl + '?corpname=' + params.corpname[0] + '&chunk=' + params.chunk[i]);
            }
        }
        return ans;
    };

    /**
     * Animates Play or Pause button according to the state of the player
     * (see PLAYER_STATUS_* constants).
     */
    SpeechPlayer.prototype.animateActiveButton = function () {
        var stateClass1,
            stateClass2,
            blinkingElement = null;

        clearInterval(this.animationTimer);
        if (this.status === this.PLAYER_STATUS_PAUSED) {
            $('#audio-play-button').removeClass().addClass('img-button-play');
            blinkingElement = 'audio-pause-button';
            stateClass1 = 'img-button-pause';
            stateClass2 = 'img-button-pause-b';

        } else if (this.status === this.PLAYER_STATUS_PLAYING) {
            $('#audio-pause-button').removeClass().addClass('img-button-pause');
            blinkingElement = 'audio-play-button';
            stateClass1 = 'img-button-play';
            stateClass2 = 'img-button-play-b';
        }

        if (blinkingElement) {
            this.animationTimer = setInterval(function () {
                if ($('#' + blinkingElement).hasClass(stateClass1)) {
                    $('#' + blinkingElement).removeClass().addClass(stateClass2);

                } else {
                    $('#' + blinkingElement).removeClass().addClass(stateClass1);
                }
            }, this.BLINKING_INTERVAL);
        }
    };

    /**
     * Creates simple three-button (play, pause, stop) interface for the player
     * and defines 'click' handlers for the buttons.
     */
    SpeechPlayer.prototype.createUserInterface = function () {
        var self = this;

        $(this.wrapper).empty().append('<div class="audio-controls">' +
            '<a id="audio-play-button" class="img-button-play"></a>' +
            '<a id="audio-pause-button" class="img-button-pause"></a>' +
            '<a id="audio-stop-button" class="img-button-stop"></a>' +
            '</div>');

        $('#audio-stop-button').bind('click', function () {
            soundManager.stop('speech-player');
            self.removeUserInterface();
            soundManager.destroySound(self.playSessionId);
        });

        $('#audio-pause-button').bind('click', function () {
            if (self.status === self.PLAYER_STATUS_PAUSED) {
                soundManager.play(self.playSessionId);
                self.status = self.PLAYER_STATUS_PLAYING;

            } else if (self.status === self.PLAYER_STATUS_PLAYING) {
                soundManager.pause(self.playSessionId);
                self.status = self.PLAYER_STATUS_PAUSED;
            }
            self.animateActiveButton();
        });

        $('#audio-play-button').bind('click', function () {
            if (self.status === self.PLAYER_STATUS_STOPPED) {
                soundManager.play(self.playSessionId);
                self.status = self.PLAYER_STATUS_PLAYING;

            } else if (self.status === self.PLAYER_STATUS_PAUSED) {
                soundManager.play(self.playSessionId);
                self.status = self.PLAYER_STATUS_PLAYING;
            }
            self.animateActiveButton();
        });
    };

    /**
     * Clears all animations and cleans-up contents of the 'wrapper' element.
     */
    SpeechPlayer.prototype.removeUserInterface = function () {
        clearInterval(this.animationTimer);
        $(this.wrapper).empty();
    };

    /**
     * Plays the audio file as specified by the player.triggerLink element.
     */
    SpeechPlayer.prototype.play = function () {
        var sound,
            outsideClickHandler,
            self = this;

        outsideClickHandler = function () {
            self.removeUserInterface();
            $(document).unbind('click', outsideClickHandler);
        };

        this.createUserInterface();
        sound = soundManager.createSound({
            id: this.playSessionId,
            url: this.itemsToPlay.shift(),
            autoLoad: true,
            autoPlay: false,
            volume: this.volume,
            onload: function (bSuccess) {
                if (!bSuccess) {
                    clearInterval(self.animationTimer);
                    $(self.wrapper).empty().append('<div class="audio-controls"><a class="audio-error-confirm">:-(</a></div>');
                    $('div.audio-controls a.audio-error-confirm').bind('click', function () {
                        self.removeUserInterface();
                    });
                    $(document).bind('click', outsideClickHandler);
                }
            },
            onplay: function () {
            },
            onfinish: function () {
                self.status = self.PLAYER_STATUS_STOPPED;
                soundManager.destroySound(self.playSessionId);
                self.removeUserInterface();
                if (self.itemsToPlay.length > 0) {
                    soundManager.destroySound(self.playSessionId);
                    self.play();
                }
            }
        });

        sound.play();
        this.status = this.PLAYER_STATUS_PLAYING;
        this.animateActiveButton();
    };

    // export constructor
    lib.SpeechPlayer = SpeechPlayer;

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
    lib.create = function (wrapper, triggerLink, options) {
        var player;

        if (win.audioPlayer) {
            win.audioPlayer.removeUserInterface();
            delete win.audioPlayer;
        }

        options = options || {};
        player = new SpeechPlayer(wrapper, triggerLink);
        if (options.hasOwnProperty('volume')) {
            player.volume = options.volume;
        }
        win.audioPlayer = player;
        return win.audioPlayer;
    };

    return lib;

});