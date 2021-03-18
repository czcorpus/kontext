/*
 * Copyright (c) 2018 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as React from 'react';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Kontext } from '../../types/common';
import { MessageModel, MessageModelState } from '../../models/common/layout';
import { ConcServerArgs } from '../../models/concordance/common';
import { Dict } from 'cnc-tskit';
import * as S from './style';


export interface MessageViewProps {
    issueReportingView:React.FC<{}>|React.ComponentClass<{}>;
    widgetProps:any;
    anonymousUser:boolean;
    lastUsedCorpus:{corpname:string; human_corpname:string};
    lastUsedConc?:{id:string; args:ConcServerArgs};
}

export interface MessageViews {
    MessagePageHelp:React.ComponentClass<MessageViewProps, MessageModelState>;
}

export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers, model:MessageModel):MessageViews {

    const layoutViews = he.getLayoutViews();


    // ---------------------- <Message /> ------------------------------------

    const Message:React.FC<{
        status:Kontext.UserMessageTypes;
        text:string;

    }> = (props) => {
        return (
            <div className="message">
                <layoutViews.StatusIcon status={props.status} />
                <div className="message-text">
                    {props.text}
                </div>
            </div>
        );
    };

    // ---------------------- <MessagePageHelp /> ------------------------------------

    const MessagePageHelp:React.FC<MessageViewProps & MessageModelState> = (props) => {

        const handleCorporaClick = () => {
            window.location.href = he.createActionLink('corpora/corplist');
        };

        const createConcArgs = () => {
            if (props.lastUsedConc) {
                const args = props.lastUsedConc.args ? {...props.lastUsedConc.args} : {};
                if (!Dict.hasKey('q', args)) {
                    args['q'] = props.lastUsedConc.id;
                }
                return Dict.toEntries(args);
            }
            return [];
        };

        return (
            <S.MessagePageHelp>
                <S.MessagesDiv>
                    {props.messages.map(message => {
                        return <Message key={message.messageId} status={message.messageType} text={message.messageText} />;
                    })}
                </S.MessagesDiv>
                <h2>{he.translate('global__where_to_continue')}:</h2>
                <ul className="links">
                    {props.lastUsedConc ?
                        <li>
                            <a href={he.createActionLink('view', createConcArgs())}>
                                {he.translate('global__view_last_concordance')}
                            </a>
                        </li> :
                        null
                    }
                    {props.lastUsedCorpus.corpname ?
                        <li>
                            <a href={he.createActionLink('query', [['corpname', props.lastUsedCorpus.corpname]])}>
                                {he.translate('global__select_last_used_corpus_{corpname}', {corpname: props.lastUsedCorpus.human_corpname})}
                            </a>
                        </li> :
                        null
                    }
                    <li>
                        <a onClick={handleCorporaClick}>{he.translate('global__view_avail_corpora')}</a>
                    </li>
                    {props.issueReportingView && !props.anonymousUser ?
                        <li><props.issueReportingView {...props.widgetProps} /></li> :
                        null
                    }
                </ul>
            </S.MessagePageHelp>
        );
    };


    return {
        MessagePageHelp: BoundWithProps<MessageViewProps, MessageModelState>(MessagePageHelp, model)
    };

}