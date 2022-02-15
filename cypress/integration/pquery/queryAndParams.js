/// <reference types="cypress" />


describe('Paradigmatic query', () => {

    beforeEach(() => {
        cy.actionLogin();
    });

    afterEach(() => {
        cy.actionLogout();
    });

    it('defines a query using separate sub-queries, submits, changes min freq. and re-evaluates', () => {
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 3);

        cy.get('#pquery-form-mount .cql-input').eq(0).type('[word="e.*"]');
        cy.get('#pquery-form-mount .cql-input').eq(1).type('[tag="N.*"]');
        cy.get('#pquery-form-mount button.add').click();
        cy.get('#pquery-form-mount .cql-input').eq(2).type('[tag="V.*"]');
        cy.get('#pquery-form-mount .submit').click();

        // test result page
        cy.url({timeout: 8000}).should('include', '/pquery/result');
        cy.get('#pquery-result-mount .data tbody tr').should('have.length', 7);
        cy.get('#pquery-result-mount .data thead tr:nth-child(2) th:nth-child(9) a img.sort-flag').should('exist');

        // test notifications
        cy.popUpNotifications();
        cy.get('.async-task-list table tbody tr').should('have.length', 1);
        cy.get('.async-task-list table td.task-type').contains('Paradigmatic query');
        cy.get('.async-task-list table td.status').contains('Finished');
        cy.closeNotifications();

        // totals and pagination
        cy.get('#pquery-result-mount .controls p').contains('Total');
        cy.get('#pquery-result-mount .controls p').contains('7');
        cy.get('#pquery-result-mount .controls section a').should('have.length', 2);
        cy.get('#pquery-result-mount .controls section .num-input input').should('exist');

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Paradigmatic query');

        // sort by value
        cy.get('#pquery-result-mount .data thead tr:nth-child(2) th:nth-child(2)').click();
        cy.get('#pquery-result-mount .data thead tr:nth-child(2) th:nth-child(2) a img.sort-flag')
            .invoke('attr', 'src')
            .should('include', '/sort_desc.svg');

        // re-edit query - increase min. freq. to 10
        cy.get('.corpus-and-query ul li a.args').click();
        cy.get('.closeable-frame input#freq_pqitem_0').clear().type(10);
        cy.get('.closeable-frame button.submit').click();
        cy.url({timeout: 8000}).should('include', '/pquery/result');
        cy.get('#pquery-result-mount .data tbody tr').should('have.length', 2);

    });

    it('defines a query using a single query, submits, changes page size', () => {
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 3);

        cy.get('#pquery-form-mount label[for="pqtype-switch"]').click();
        cy.get('#pquery-form-mount .cql-input').type(
            '{ [] within <doc file="J23" /> } && { [] within <doc file="G05" /> } && !{ [] within <doc file="J09" /> }',
            { parseSpecialCharSequences: false }
        );
        cy.get('#pquery-form-mount .submit').click();

        cy.url({timeout: 8000}).should('include', '/pquery/result');
        cy.get('#pquery-result-mount .data tbody tr').should('have.length', 5);
    });

});