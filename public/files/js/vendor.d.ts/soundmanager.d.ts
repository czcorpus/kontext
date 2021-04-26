/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

// the description comments are based on
// project's original documentation
// at http://www.schillmania.com/projects/soundmanager2

declare module "vendor/SoundManager" {

    export interface SoundManagerConfig {

        /**
         * the directory where SM2 can find the flash movies (soundmanager2.swf,
         * soundmanager2_flash9.swf and debug versions etc.) Note that SM2 will
         * append the correct SWF file name, depending on flashVersion and debugMode
         * settings.
         */
        url?:string;

        /**
         * for scripting the SWF (object/embed property), 'always' or 'sameDomain'
         */
        allowScriptAccess?:string;

        /**
         * SWF background color. N/A when wmode = 'transparent'
         */
        bgColor?:string;

        /**
         * if console is being used, do not create/write to #soundmanager-debug
         */
        consoleOnly?:boolean;

        /**
         * enable debugging output (console.log() with HTML fallback)
         */
        debugMode?:boolean;

        /**
         * enable debugging output inside SWF, troubleshoot Flash/browser issues
         */
        debugFlash?:boolean;

        /**
         * flash build to use (8 or 9.) Some API features require 9.
         */
        flashVersion?:number;

        /**
         * msec affecting whileplaying/loading callback frequency. If null,
         * default of 50 msec is used.
         */
        flashPollingInterval?:number;

        /**
         * if true, a single Audio() object is used for all sounds - and only one
         * can play at a time.
         */
        forceUseGlobalHTML5Audio?:boolean;

        /**
         * msec affecting whileplaying/loading callback frequency. If null, native HTML5
         * update events are used.
         */
        html5PollingInterval?:number;

        /**
         * HTML5 Audio() format support test. Use 'probably' if you want to be more
         * conservative (other value: 'maybe')
         */
        html5Test?:string;

        /**
         * msec to wait for flash movie to load before failing (0 = infinity)
         */
        flashLoadTimeout?:number;

        /**
         * if an id is not provided to createSound(), this prefix is used for generated IDs - 'sound0', 'sound1' etc.
         */
        idPrefix?:string;

        /**
         * if true, SM2 will not apply global HTML5 audio rules to mobile UAs. iOS > 7 and WebViews may allow
         * multiple Audio() instances.
         */
        ignoreMobileRestrictions?:boolean;

        /**
         * if true, appends ?ts={date} to break aggressive SWF caching.
         */
        noSWFCache?:boolean,

        /**
         * overrides useHTML5audio. if true and flash support present, will try to use flash for MP3/MP4 as needed.
         * Useful if HTML5 audio support is quirky.
         */
        preferFlash?:boolean;

        /**
         * use console.log() if available (otherwise, writes to #soundmanager-debug element)
         */
        useConsole?:boolean;

        /**
         * requires flashblock.css, see demos - allow recovery from flash blockers. Wait indefinitely
         * and apply timeout CSS to SWF, if applicable.
         */
        useFlashBlock?:boolean;

        /**
         * position:fixed flash movie can help increase js/flash speed, minimize lag
         */
        useHighPerformance?:boolean;

        /**
         * use HTML5 Audio() where supported. Some browsers may not support
         * "non-free" MP3/MP4/AAC codecs. Ideally, transparent vs. Flash API where possible.
         */
        useHTML5Audio?:boolean;

        /**
         * force SM2 to wait for window.onload() before trying to call soundManager.onready()
         */
        waitForWindowLoad?:boolean;

        /**
         * flash rendering mode - null, 'transparent', or 'opaque' (last two allow z-index)
         */
        wmode?:string;
    }

    export interface InstantPlayConfig extends SoundManagerConfig {
        id:string;
        autoLoad:boolean;
        autoPlay:boolean;
        stream?:boolean;
        volume:number;
        from?:number;
        onload:(succ:boolean)=>void;
        onplay:()=>void;
        onfinish:()=>void;
        whileplaying:(arg:any)=>void;
    }

    export interface Sound {
        play():void;
        url:string;
    }

    export interface SoundManager {
       setup(conf:SoundManagerConfig):void;
       createSound(conf:InstantPlayConfig):Sound;
       destroySound(playSessionId:string):void;
       stop(playSessionId:string):void;
       play(playSessionId:string):void;
       pause(playSessionId:string):void;
       ontimeout(status:{success:boolean;error:any}):void;
       setPosition(playSessionId:string,offset:number):Sound;
    }

    export interface GetInstance {
        ():SoundManager;
    }

    export var soundManager:SoundManager;
}