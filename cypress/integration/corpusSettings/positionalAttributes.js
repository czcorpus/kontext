/// <reference types="cypress" />


describe('corpus settings - positional attributes', () => {

    beforeEach(() => {
        cy.viewport(1600, 1200);
        cy.visit('http://localhost:8080/query?corpname=susanne');
    });

    it('tests displaying and closing corpus settings', () => {
        // open corpus options
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        // check options are displayed
        cy.get('#view-options-mount').should('not.be.empty');
        // close window
        cy.get('#view-options-mount img.close-icon').click();
        // check options are not displayed
        cy.get('#view-options-mount').should('be.empty');
    });

    it('test adding tag and changing primary attribute', () => {
        // create concordance
        cy.get('.simple-input').type('car');
        cy.get('.query .default-button').click();
        cy.url({timeout: 5000}).should('include', '/view');

        // display additional tag attribute
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount input[type="checkbox"][name="setattrs"][value="tag"]').click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test visible displayed attributes
        cy.get('#conc-dashboard-mount table tbody tr td.kw mark').should('contain', 'car');
        cy.get('#conc-dashboard-mount table tbody tr td.kw span.tail.attr').should('contain', 'NN1c');

        // set tag as primary attribute
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount td.unique-sel input').eq(2).click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test visible displayed attributes
        cy.get('#conc-dashboard-mount table tbody tr td.kw mark').should('contain', 'NN1c');
        cy.get('#conc-dashboard-mount table tbody tr td.kw span.tail.attr').should('contain', 'car');
    });

    it('test display options', () => {
        // create concordance
        cy.get('.simple-input').type('car');
        cy.get('.query .default-button').click();
        cy.url({timeout: 5000}).should('include', '/view');

        // set visible kwic option
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount input[type="checkbox"][name="setattrs"][value="tag"]').click();
        cy.get('#view-options-mount input[type="radio"][value="visible-kwic"]').click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test visible kwic option
        cy.get('#conc-dashboard-mount table tbody tr td.lc span[title]').invoke('attr', 'title').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.lc span.tail.attr').should('not.exist');
        cy.get('#conc-dashboard-mount table tbody tr td.kw strong[title]').invoke('attr', 'title').should('be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.kw span.tail.attr').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span[title]').invoke('attr', 'title').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span.tail.attr').should('not.exist');

        // set mouseover option
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount input[type="radio"][value="mouseover"]').click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test mouseover option
        cy.get('#conc-dashboard-mount table tbody tr td.lc span[title]').invoke('attr', 'title').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.lc span.tail.attr').should('not.exist');
        cy.get('#conc-dashboard-mount table tbody tr td.kw strong[title]').invoke('attr', 'title').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.kw span.tail.attr').should('not.exist');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span[title]').invoke('attr', 'title').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span.tail.attr').should('not.exist');

        // set visible all option
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount input[type="radio"][value="visible-all"]').click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test visible all option
        cy.get('#conc-dashboard-mount table tbody tr td.lc span[title]').invoke('attr', 'title').should('be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.lc span.tail.attr').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.kw strong[title]').invoke('attr', 'title').should('be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.kw span.tail.attr').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span[title]').invoke('attr', 'title').should('be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span.tail.attr').should('not.be.empty');

        // set visible multiline option
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 2);
        cy.get('#view-options-mount input[type="radio"][value="visible-multiline"]').click();
        cy.get('#view-options-mount .buttons button').click();
        // close option save message
        cy.get('.messages-mount .message .button-box .close-icon').click();

        // test visible multiline option
        cy.get('#conc-dashboard-mount table tbody tr td.lc span.ml[title]').invoke('attr', 'title').should('be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.lc span.ml span.tail.attr').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.kw strong.ml[title]').invoke('attr', 'title').should('be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.kw strong.ml span.tail.attr').should('not.be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span.ml[title]').invoke('attr', 'title').should('be.empty');
        cy.get('#conc-dashboard-mount table tbody tr td.rc span.ml span.tail.attr').should('not.be.empty');
    });

});