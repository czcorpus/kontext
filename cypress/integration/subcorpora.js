/// <reference types="cypress" />


describe('Subcorpora', () => {

    beforeEach(() => {
        cy.actionLogin();
    });

    afterEach(() => {
        cy.actionLogout();
    });

    it('tests empty subcorpora list', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // contains only heading row
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 1);
    });

    it('creates subcorpus', () => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 4);

        // create subcorpus from text type
        cy.get('#subcorp-form-mount table.form .subcname input').type('sus1');
        cy.get('#subcorp-form-mount div.data-sel div.grid > div').eq(1).get('input[type=checkbox]').check('1');
        cy.get('#subcorp-form-mount p.submit-buttons button').last().click();

        // table contains `sus1` subcorpus
        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('sus1').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('a', 'sus1').click();
        cy.url().should('include', '/query');
    });

    it('creates subcorpus draft', () => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 4);

        // create subcorpus draft from text type
        cy.get('#subcorp-form-mount table.form .subcname input').type('sus2');
        cy.get('#subcorp-form-mount div.data-sel div.grid > div').eq(1).get('input[type=checkbox]').check('1');
        cy.get('#subcorp-form-mount p.submit-buttons').contains('button', 'Save draft').click();

        // contains one subcorpus
        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('a', 'sus2').should('have.length', 1);
        cy.get('td').filter((index, elt) => { return elt.innerText.match(/draft/) }).should('have.length', 1);
    });

    it('creates subcorpus draft from query view', () => {
        cy.url().should('include', '/query');

        // create subcorpus draft from text type
        cy.contains('h2 a', 'Restrict search').click();
        cy.get('input[type=checkbox]').check('1');
        cy.contains('a.util-button', 'Save as a subcorpus draft').click();
        cy.get('input[name=subcorpName]').type('sus3');
        cy.contains('button', 'Create draft').click();

        // still on query page
        cy.url().should('include', '/query');

        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        cy.get('td').filter((index, elt) => { return elt.innerText.match(/draft/) }).should('have.length', 2);
    });

    it('creates subcorpus from draft', () => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        cy.get('#my-subcorpora-mount table.data tbody tr a').contains('sus2').click();
        cy.url().should('include', '/subcorpus/new');
        cy.get('#subcorp-form-mount p.submit-buttons button').contains('Create subcorpus').click();
        cy.url().should('include', '/subcorpus/list');
        cy.get('td').contains('draft').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr a').contains('sus2').click();
        cy.url().should('include', '/query');
    });

    it('creates subcorpus from draft using properties window', () => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus3').find('a.properties-subc').click();
        cy.contains('button', 'Subcorpus structure').click();
        cy.contains('button', 'Create subcorpus').click();
        cy.get('.closeable-frame .heading .control img').click();
        cy.get('td').contains('draft').should('have.length', 0);
    });

    it('checks subcorp page size settings', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // set subcorpus page size to 1
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetSubcList table input[type=text]').clear().type(1);
        cy.get('#view-options-mount div.buttons button').click();

        cy.reload()
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 2);

        // set subcorpus page size to 10
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetSubcList table input[type=text]').clear().type(10);
        cy.get('#view-options-mount div.buttons button').click();

        cy.reload()
        cy.get('#my-subcorpora-mount table.data tbody tr').its('length').should('be.gt', 2);
    });

    it('removes one subcorpus using properties window', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 4);
        cy.get('#my-subcorpora-mount table.data tbody tr a.properties-subc').first().click();
        cy.contains('#my-subcorpora-mount .closeable-frame button', 'Delete').click();
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 3);
    });

    it('removes all remaining subcorpora using checkboxes', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        cy.get('#my-subcorpora-mount table.data tbody tr').its('length').should('be.gt', 1);
        cy.get('td input[type=checkbox]').check();
        cy.contains('button', 'Delete').click();
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 1);
    });

    it('creates subcorpus draft, edits it and removes it', () => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 4);

        // create subcorpus draft from text type
        cy.get('#subcorp-form-mount table.form .subcname input').type('sus-sub');
        cy.get('#subcorp-form-mount div.data-sel div.grid > div').eq(1).get('input[type=checkbox]').check('1');
        cy.get('#subcorp-form-mount p.submit-buttons').contains('button', 'Save draft').click();

        // contains one subcorpus
        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus-sub').find('a.properties-subc').click();
        cy.contains('button', 'Subcorpus structure').click();
        cy.get('input[value=1]').should('be.checked');
        cy.get('input[value=2]').should('not.be.checked');
        cy.get('input[type=checkbox]').check('2');
        cy.contains('button', 'Save draft').click();
        cy.get('.closeable-frame .heading .control img').click();
        cy.get('#my-subcorpora-mount table.data tbody tr a').contains('sus-sub').click();

        cy.url().should('include', '/subcorpus/new');
        cy.get('input[value=1]').should('be.checked');
        cy.get('input[value=2]').should('be.checked');
        cy.get('input[type=checkbox]').uncheck('1');
        cy.contains('button', 'Save draft').click();

        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus-sub').find('a.properties-subc').click();
        cy.contains('button', 'Subcorpus structure').click();
        cy.get('input[value=1]').should('not.be.checked');
        cy.get('input[value=2]').should('be.checked');

        cy.contains('button', 'File').click();
        cy.contains('button', 'Delete').click();

        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 1);
    });
});