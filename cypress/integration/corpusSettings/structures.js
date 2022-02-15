/// <reference types="cypress" />


describe('corpus settings - structures', () => {

    beforeEach(() => {
        cy.viewport(1600, 1200);
        cy.visit('http://localhost:8080/query?corpname=susanne');
    });

    it('test adding tag and changing primary attribute', () => {
        // create concordance
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();
        cy.url({timeout: 5000}).should('include', '/view');

        // test there are no <head> and <p> structures by default
        cy.get('#conc-dashboard-mount table tbody').should('not.contain', '</head>');
        cy.get('#conc-dashboard-mount table tbody').should('not.contain', '</p>');

        // display <head> and <p> structures
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount ul.FieldsetsTabs li:nth-child(2) button').click();
        cy.get('#view-options-mount section.StructsAndAttrsCheckboxes div.group:nth-child(3) input.select-all').click();
        cy.get('#view-options-mount section.StructsAndAttrsCheckboxes div.group:nth-child(4) input').click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test there <head> and <p> structures are visible
        cy.get('#conc-dashboard-mount table tbody').should('contain', '</head>');
        cy.get('#conc-dashboard-mount table tbody').should('contain', '</p>');
    });

});