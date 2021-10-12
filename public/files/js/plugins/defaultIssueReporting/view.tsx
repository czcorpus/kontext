/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as Kontext from '../../types/kontext';
import { IssueReportingModel, IssueReportingModelState } from './init';
import { IActionDispatcher, BoundWithProps } from 'kombo';
import { Actions } from './actions';


export interface IssueReportingWidgetProps {

}


export interface Views {
    IssueReportingWidget:React.ComponentClass<IssueReportingWidgetProps>;
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    reportingModel:IssueReportingModel

):Views {

    const layoutViews = he.getLayoutViews();

    // -------------- <SubmitButton /> -------------------------------------

    const SubmitButton:React.FC<{
        waitingForModel:boolean;

    }> = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch<typeof Actions.SubmitIssue>({
                name: Actions.SubmitIssue.name,
                payload: {}
            });
        };

        if (props.waitingForModel) {
            return <img src={he.createStaticUrl('img/ajax-loader-bar.gif') }
                            title={he.translate('global__loading')} />;

        } else {
            return (
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('defaultIR__submit_btn')}
                </button>
            );
        }
    };

    // -------------- <IssueReportingForm /> -------------------------------------

    const IssueReportingForm:React.FC<{
        value:string;
        waitingForModel:boolean;
        closeClickHandler:()=>void;

    }> = (props) => {

        const handleTextareaChange = (evt) => {
            dispatcher.dispatch<typeof Actions.UpdateIssueBody>({
                name: Actions.UpdateIssueBody.name,
                payload: {value: evt.target.value}
            });
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.CloseableFrame onCloseClick={props.closeClickHandler}
                        label={he.translate('defaultIR__report_issue_heading')}>
                    <form>
                        <textarea rows={10} cols={60} onChange={handleTextareaChange}
                                value={props.value} />
                        <p>
                            <SubmitButton waitingForModel={props.waitingForModel} />
                        </p>
                    </form>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    // -------------- <IssueReportingWidget /> -------------------------------------

    class IssueReportingWidget extends React.Component<IssueReportingWidgetProps & IssueReportingModelState> {

        constructor(props) {
            super(props);
            this._handleLinkClick = this._handleLinkClick.bind(this);
            this._closeClickHandler = this._closeClickHandler.bind(this);
        }


        _handleLinkClick() {
            dispatcher.dispatch<typeof Actions.SetVisibility>({
                name: Actions.SetVisibility.name,
                payload: {value: true}
            });
        }

        _closeClickHandler() {
            dispatcher.dispatch<typeof Actions.SetVisibility>({
                name: Actions.SetVisibility.name,
                payload: {value: false}
            });
        }

        render() {
            return (
                <div>
                    <a onClick={this._handleLinkClick}>
                        {he.translate('defaultIR__report_issue_link')}
                    </a>
                    {this.props.isActive ?
                        <IssueReportingForm closeClickHandler={this._closeClickHandler}
                            value={this.props.issueBody}
                            waitingForModel={this.props.isBusy} /> :
                        null
                    }
                </div>
            );
        }

    }


    return {
        IssueReportingWidget: BoundWithProps<IssueReportingWidgetProps, IssueReportingModelState>(IssueReportingWidget, reportingModel)
    };

}