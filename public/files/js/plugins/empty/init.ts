import RSVP from 'rsvp';
import {IPluginApi} from '../../types/plugins';

export class EmptyPlugin {

    getViews() {
        return {};
    }

    create() {
        return new RSVP.Promise(function (fulfill, reject) {
            fulfill(null);
        });
    }
}


export default function create(...args:Array<any>):RSVP.Promise<any> {
    return new RSVP.Promise((resolve:(d)=>void, reject:(err)=>void) => {
        resolve(new EmptyPlugin());
    });
}