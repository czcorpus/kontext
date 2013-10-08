/*
 * Copyright (c) 2013 Institute of the Czech National Corpus
 * Copyright (c) 2003-2009  Pavel Rychly
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

define(['jquery', 'audioplayer'], function ($, audioPlayer) {

    var self = {

        /**
         *
         * @param url
         * @param params
         * @param loadtext
         * @param erase
         * @param callback function called after the ajax's complete event is triggered
         */
        showDetail : function (url, params, loadtext, erase, callback) {
            // show detailed info in bottom div
            $('#detailframe').fadeIn(100);
            if (erase) {
                $('#detailframecontent').html('<span class="load">' + loadtext + '</span>');
            }
            $.ajax({
                url: url,
                type: 'GET',
                data: params,
                complete: function (data) {
                    $('#detailframecontent').html(data.responseText);
                    $(document).on('keyup', self.escKeyEventHandler);
                    if (callback) {
                        callback();
                    }
                }
            });
        },

        /**
         *
         */
        escKeyEventHandler : function (event) {
            if (event.keyCode === 27) {
                self.closeDetail(event);
            }
        },

        /**
         *
         * @param event
         */
        closeDetail : function (event) {
            $(document).off('keyup', self.escKeyEventHandler);
            $('#detailframe').fadeOut(100);
            $('#conclines tr.active').removeClass('active');
            event.stopPropagation();
        },

        /**
         *
         * @param linkElem
         */
        openSpeech : function (linkElem) {
            var speechURL = $(linkElem).attr('href');
            audioPlayer.create('audio-wrapper', linkElem, { volume : 90 }).play(speechURL);
        }
    };

    return self;
});