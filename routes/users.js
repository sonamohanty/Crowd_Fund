const express = require('express');
const passwordHash = require('password-hash');
const router = express.Router();
const data = require('../data');
const userData = data.users;
const projectData = data.projects;
const utilities = require('../public/js/utilities');
const xss = require('xss');

router.get('/signin',async (req, res) => {
    if (req.session.user) {
        res.redirect('/projects');
        return;
    }
    res.render('users/signin',{title: 'Sign In', logged: false});
});

router.get('/register',async (req,res) => {
    if (req.session.user) {
        res.redirect('/projects');
        return;
    }
    res.render('users/register',{title: 'Register', logged: false});
});

router.post('/signin',async (req, res) => {
    let loginInfo = req.body;
    let errors = [];

    if (!loginInfo.email)
        errors.push('Please enter your email');

    if(!loginInfo.password)
        errors.push('Please enter your password');

    if (errors.length > 0) {
        res.render('users/signin', {
            errors: errors,
            hasErrors: true,
            logged: false
        });
        return;
    }
    let user;
    try{
        user = await userData.getUserByEmail(loginInfo.email.toLowerCase());
    } catch(e) {
        res.render('users/signin',{hasErrors: true, title: 'Sign In', errors: ['Invalid email and/or password'], logged: false});
        return;
    }
    const compareHashedPassword =  passwordHash.verify(loginInfo.password, user.passwordHash);
    if (compareHashedPassword){
        req.session.user = { firstName: user.firstName, lastName: user.lastName, userId: user._id };
        res.redirect('/projects');
    }
    else
        res.render('users/signin',{hasErrors: true, title: 'Sign In', errors: ['Invalid email and/or password'], logged: false});
});

router.post('/', async (req, res) => {
    let newUser = req.body;
    let errors = [];
    const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    if (!newUser.first_name)
		errors.push('No first name provided');

    if(!newUser.last_name)
        errors.push('No last name provided');

    if(!newUser.email)
        errors.push('No email provided');

    if(newUser.email && !emailRegex.test(newUser.email))
        errors.push('Invalid email');

	if (!newUser.password)
		errors.push('No password provided');

	if(newUser.password && newUser.password.length < 8)
	    errors.push('Password should contain at least 8 characters');

    if (!newUser.password_confirm)
        errors.push('No password confirmation provided');

    if(newUser.password_confirm !== newUser.password)
        errors.push('Passwords don\'t match');

    if (!newUser.city)
		errors.push('No city provided');

    if (!newUser.state)
		errors.push('No state provided');

    if (!newUser.email)
        errors.push('No email provided');
    
    newUser.email = newUser.email.toLowerCase();
    
    try{
        const existingEmail =  await userData.getUserByEmail(newUser.email.toLowerCase());
        if (existingEmail)
            errors.push('An account with this email already exists.');
    } catch(e) {}
    
    if (errors.length > 0) {
		res.render('users/register', {
		    title: 'Register',
			errors: errors,
			hasErrors: true,
			user: newUser,
            logged: false
		});
		return;
    }
    try {
        const hashedPassword = passwordHash.generate(newUser.password);
        await userData.addUser(xss(newUser.first_name), xss(newUser.last_name), xss(newUser.email.toLowerCase()),
            hashedPassword, xss(newUser.city), xss(newUser.state));
        res.redirect('/users/signin');
    }catch(e){
        res.status(500).json({error: e.toString()})
  }
});

router.get('/logout', async (req, res) => {
    if (!req.session.user) {
        res.redirect('/projects');
        return;
    }
    req.session.destroy();
    res.redirect('/projects');
});

router.get('/history/:userId', async (req, res) => {
    // List the campaigns created by the user whose ID is 'userId' as well as the campaigns to which this user donated
    if (req.params.userId !== req.session.user.userId) {
        res.redirect('/projects');
        return;
    }
    try {
        let projects = await projectData.getProjectsByUser(req.params.userId);
        const user = await userData.getUser(req.params.userId);
        let hasDonated = user.donated.length !== 0;
        for(let donation of user.donated) {
            const project = await projectData.getProject(donation.projectId);
            let user = await userData.getUser(project.creator);
            donation.projectTitle = project.title;
            donation.projectCreator = user.firstName + " " + user.lastName;
        }
        if(projects.length > 0)
            projects = utilities.sortProjectsByCreationDate(projects);

        for (let project of projects) {
            project.date = project.date.toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric' });
            project.pledgeGoal = project.pledgeGoal.toLocaleString();
            project.collected = project.collected.toLocaleString();
            project.donors = project.donations.length;
        }
        res.render('users/history', {title: 'My Projects', hasProjects: projects.length !== 0,
            projects: projects, hasDonated: hasDonated, donated: user.donated, logged: true, user: req.session.user});
    } catch (e) {
        // The reason to change this is because if a user has no projects, it will get the error at
        // "const projects = await projectData.getProjectsByUser()", which throws an error without checking
        // projects.length !== 0. What has been changed is the data/project getProjectsByUser()
        res.status(500).json({ error: e.toString() });
    }
});

module.exports = router;