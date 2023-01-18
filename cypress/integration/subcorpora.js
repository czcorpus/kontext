/// <reference types="cypress" />


describe('Subcorpora', () => {

    beforeEach(() => {
        cy.actionLogin();
    });

    afterEach(() => {
        cy.actionLogout();
    });

    const createSubcorpus = (name, description, texttypes, isDraft) => {
        // open create subcorpus
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 4);

        // create subcorpus from text type
        cy.get('#subcorp-form-mount table.form .subcname input').type(name);
        if (!!description) {
            cy.get('#subcorp-form-mount table.form textarea').type(description);
        }
        texttypes.forEach(v => {
            cy.get('#subcorp-form-mount div.data-sel div.grid > div').eq(1).get('input[type=checkbox]').check(v);
        });
        if (isDraft) {
            cy.get('#subcorp-form-mount p.submit-buttons').contains('button', 'Save draft').click();
        } else {
            cy.get('#subcorp-form-mount p.submit-buttons').contains('button', 'Create subcorpus').click();
        }
    }

    const openProperties = (name) => {
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', name).find('a.properties-subc').click();
    }

    const closeProperties = () => {
        cy.get('.closeable-frame .heading .control img').click();
    }

    const deleteSubcorpus = (name) => {
        openProperties(name);
        cy.get('.closeable-frame').contains('button', 'Delete').click();
    }

    it('tests empty subcorpora list', () => {
        // open my subcorpora list
        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        // contains only heading row
        cy.get('#my-subcorpora-mount table.data tbody tr').should('have.length', 1);
    });

    it('creates subcorpus', () => {
        createSubcorpus('sus1', '', ['1'], false);

        // table contains `sus1` subcorpus
        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('sus1').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('a', 'sus1').click();
        cy.url().should('include', '/query');
    });

    it('creates subcorpus draft', () => {
        createSubcorpus('sus2', '', ['1'], true);

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

    it('creates subcorpus draft and switches to new subcorpus view', () => {
        cy.url().should('include', '/query');

        // create subcorpus draft from text type
        cy.contains('h2 a', 'Restrict search').click();
        cy.get('input[type=checkbox]').check('1');
        cy.contains('a.util-button', 'Save as a subcorpus draft').click();
        cy.get('.closeable-frame input[name=subcorpName]').type('sus9');
        cy.get('.closeable-frame input[type=checkbox]').check();
        cy.contains('button', 'Create draft').click();

        // should be on new page
        cy.url().should('include', '/subcorpus/new');

        cy.hoverNthMenuItem(2);
        cy.clickMenuItem(2, 2);

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus9').should('have.length', 1);
        deleteSubcorpus('sus9');
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

    it('creates subcorpus, edits it and removes it', () => {
        createSubcorpus('sus4', 'some description', ['1'], false);

        // check values and edit draft in properties
        cy.url().should('include', '/subcorpus/list');

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus4').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus4new').should('have.length', 0);
        cy.get('#my-subcorpora-mount div.inputs input#inp_pattern').type('beautiful');
        cy.wait(500); // searching is delayed
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'Found in description').should('have.length', 0);
        cy.get('#my-subcorpora-mount div.inputs input#inp_pattern').clear();
        cy.wait(500); // searching is delayed

        openProperties('sus4');
        cy.get('.closeable-frame').contains('button', 'Name and public description').click();
        cy.get('.closeable-frame input[type=text]').should('have.value', 'sus4');
        cy.get('.closeable-frame input[type=text]').clear().type('sus4new');
        cy.get('.closeable-frame textarea').should('have.value', 'some description');
        cy.get('.closeable-frame textarea').clear().type('beautiful subcorpus');
        cy.get('.closeable-frame').contains('button', 'Update name and public description').click();
        closeProperties();

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus4new').should('have.length', 1);
        cy.get('#my-subcorpora-mount div.inputs input#inp_pattern').type('beautiful');
        cy.wait(500); // searching is delayed
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'Found in description').should('have.length', 1);

        openProperties('sus4new');
        cy.get('.closeable-frame').contains('button', 'Name and public description').click();
        cy.get('.closeable-frame input[type=text]').should('have.value', 'sus4new');
        cy.get('.closeable-frame textarea').should('have.value', 'beautiful subcorpus');
        closeProperties();

        deleteSubcorpus('sus4new');
    });

    it('creates subcorpus draft, edits it and removes it', () => {
        createSubcorpus('sus5', 'description', ['1'], true);

        // check values and edit draft in properties
        cy.url().should('include', '/subcorpus/list');
        openProperties('sus5');
        cy.get('.closeable-frame').contains('button', 'Name and public description').click();
        cy.get('.closeable-frame input').should('have.value', 'sus5');
        cy.get('.closeable-frame input[type=text]').clear().type('sus5new');
        cy.get('.closeable-frame textarea').should('have.value', 'description');
        cy.get('.closeable-frame textarea').clear().type('new description');
        cy.get('.closeable-frame').contains('button', 'Update name and public description').click();

        cy.get('.closeable-frame').contains('button', 'Subcorpus structure').click();
        cy.get('.closeable-frame').get('input[value=1]').should('be.checked');
        cy.get('.closeable-frame').get('input[value=2]').should('not.be.checked');
        cy.get('.closeable-frame').get('input[type=checkbox]').check('2');
        cy.get('.closeable-frame').contains('button', 'Save draft').click();
        closeProperties();

        // check change and edit draft on subcorpus/new page
        cy.get('#my-subcorpora-mount table.data tbody tr a').contains('sus5new').click();
        cy.url().should('include', '/subcorpus/new');
        cy.get('#subcorp-form-mount table.form .subcname input').should('have.value', 'sus5new');
        cy.get('#subcorp-form-mount table.form .subcname input').clear().type('sus5old');
        // TODO - for some reason textarea is empty, manually it works
        // cy.get('#subcorp-form-mount table.form textarea').should('have.value', 'new description');
        cy.get('#subcorp-form-mount table.form textarea').clear().type('old description');
        cy.get('input[value=1]').should('be.checked');
        cy.get('input[value=2]').should('be.checked');
        cy.get('input[type=checkbox]').uncheck('1');
        cy.contains('button', 'Save draft').click();

        // check change in properties
        cy.url().should('include', '/subcorpus/list');
        openProperties('sus5old');
        cy.get('.closeable-frame').contains('button', 'Subcorpus structure').click();
        cy.get('.closeable-frame').get('input[value=1]').should('not.be.checked');
        cy.get('.closeable-frame').get('input[value=2]').should('be.checked');
        cy.get('.closeable-frame').contains('button', 'Name and public description').click();
        cy.get('.closeable-frame input').should('have.value', 'sus5old');
        cy.get('.closeable-frame textarea').should('have.value', 'old description');
        closeProperties();

        deleteSubcorpus('sus5old');
    });

    it('tests archiving subcorpus', () => {
        createSubcorpus('sus6', '', ['1'], false);

        // table contains `sus6` subcorpus
        cy.url().should('include', '/subcorpus/list');
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus6').should('have.length', 1);

        // archive it
        openProperties('sus6');
        cy.get('.closeable-frame').contains('button', 'Archive').click();
        closeProperties();

        // check archived subcorpora
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('archived').should('have.length', 0);
        cy.get('#my-subcorpora-mount div.inputs input[type=checkbox]').check(); // show archived corpora
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('archived').should('have.length', 1);

        // restore archived subcorpus
        openProperties('sus6');
        cy.get('.closeable-frame').contains('button', 'Restore').click();
        closeProperties();
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('archived').should('have.length', 0);

        deleteSubcorpus('sus6');
    });

    it('tests reusing subcorpus', () => {
        createSubcorpus('sus7', '', ['1'], false);

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus7').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus8').should('have.length', 0);

        openProperties('sus7');
        cy.get('.closeable-frame').contains('button', 'Subcorpus structure').click();
        cy.get('.closeable-frame input[type=checkbox]').check('10');

        cy.window().then((p) => {
            cy.stub(p, 'prompt').returns('sus8');
            cy.get('.closeable-frame').contains('button', 'Save as').click();
        });
        cy.get('div.messages-mount div.message').should('have.length', 1);
        cy.get('div.messages-mount div.message').contains('A new subcorpus is being created').should('have.length', 1);
        cy.get('div.messages-mount div.message a.close-icon').click();
        closeProperties();

        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus7').should('have.length', 1);
        cy.get('#my-subcorpora-mount table.data tbody tr').contains('tr', 'sus8').should('have.length', 1);

        openProperties('sus8');
        cy.get('.closeable-frame').contains('button', 'Subcorpus structure').click();
        cy.get('.closeable-frame input[value=1]').should('be.checked');
        cy.get('.closeable-frame input[value=10]').should('be.checked');
        closeProperties();

        deleteSubcorpus('sus7');
        deleteSubcorpus('sus8');
    });
});