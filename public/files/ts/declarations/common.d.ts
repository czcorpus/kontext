
/**
 *
 */
declare module Kontext {

    /**
     * Specifies a configuration object generated at runtime
     */
    export interface Conf {
        [key:string]: any;
    }

    /**
     * An interface used by KonText plug-ins
     */
    export interface PluginApi {
        conf(key:string):any;
        createStaticUrl(path:string):string;
        createActionUrl(path:string):string;
        ajax(...args:any[]);
        ajaxAnim(): JQuery;
        ajaxAnimSmall();
        appendLoader();
        showMessage(type:string, message:string); // TODO type: MsgType vs string
        translate(text:string):string;
        applySelectAll(elm:HTMLElement, context:HTMLElement);
        registerReset(fn:Function);
        resetToHomepage(params:any); // TODO
        userIsAnonymous():boolean;
        contextHelp(triggerElm:HTMLElement, text:string);
        shortenText(s:string, length:number);
    }

    /**
     * This contains extensions required by pages which contain query input form
     */
    export interface QueryPagePluginApi extends PluginApi {
        bindFieldsetToggleEvent(callback:(fieldset:HTMLElement) => void);
    }

    /**
     *
     */
    export interface Plugin {
        init(api:PluginApi):void;
    }


    /**
     *
     */
    export interface PluginProvider {
        getPlugin(name:string):Plugin;
    }

    /**
     *
     */
    export interface Closeable {
        close(): void;
    }
}

declare module "plugins/applicationBar" {
    export function createInstance(pluginApi:Kontext.PluginApi);
}

/**
 *
 */
declare module "win" {
    var win:Window;

    export = win;
}

/**
 *
 */
declare module "queryInput" {
    export function cmdSwitchQuery(plugProvider:Kontext.PluginProvider, event:any, conf:any); // TODO types
    export function bindQueryHelpers(api:Kontext.PluginApi);
}