/// <reference types="cypress" />


describe('corpus settings - references', () => {

    beforeEach(() => {
        cy.viewport(1600, 1200);
        cy.visit('http://localhost:8080/query?corpname=susanne');
    });

    it('test adding tag and changing primary attribute', () => {
        // create concordance
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();
        cy.url({timeout: 5000}).should('include', '/view');

        // test there are default references
        cy.get('#conc-dashboard-mount table tbody tr td.ref a').invoke('text').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.ref a').first().click();
        // test displayed reference toolbox
        cy.get('#conc-dashboard-mount section.refs-detail').should('exist');
        // close it and check its gone
        cy.get('#conc-dashboard-mount section.refs-detail div.header button.close-link').click();
        cy.get('#conc-dashboard-mount section.refs-detail').should('not.exist');

        // hide all default references
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount ul.FieldsetsTabs li:nth-child(3) button').click();

        // TODO check checked checkboxes

        cy.get('#view-options-mount div.select-all-structs-and-groups input.select-all').click();
        cy.get('#view-options-mount div.select-all-structs-and-groups input.select-all').click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test there are no references
        cy.get('#conc-dashboard-mount table tbody tr td.ref a').invoke('text').should('be.empty');
    });

});