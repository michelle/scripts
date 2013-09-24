#! /usr/bin/env node

// Sends customized emails.
var nodemailer = require('nodemailer');
var argv = require('optimist')
  .usage('Usage: $0 -e [email] -p [password] -n [your name] -s [subject] -f [/path/to/message] -r [/path/to/recipients]')
  .alias('e', 'email')
  .describe('e', 'Email address (Gmail/Google apps only).')
  .alias('p', 'password')
  .describe('p', 'Your email password. If you are using 2 factor auth, you can generate an application-specific password (https://support.google.com/accounts/answer/185833?hl=en).')
  .alias('f', 'file')
  .describe('f', 'Path to file containing your message body. Should have {{X}} (e.g. {{email}}, {{name}}) for all rows in the recipients CSV that should be included in the email body. Note: {{me}} automatically substitutes the first name of the name you passed in for yourself.')
  .alias('n', 'name')
  .describe('n', 'Your name. Will appear in "from" address line.')
  .alias('r', 'recipients')
  .describe('r', 'A CSV of recipient info. Should at least have an "email" row. Basic implementation--no comma or quote support.')
  .alias('s', 'subject')
  .demand(['e', 'p', 'f', 'r', 's'])
  .argv;

var fs = require('fs');
var handlebars = require('handlebars');

// User input. TODO: possibly error check but meh.
var recipients = fs.readFileSync(argv.recipients, {encoding: 'utf-8'});
// The first string should be the heading.
recipients = recipients.split(/\n\r?/).map(function(r) { return r.split(/,\s*/); }); // whitespace-insignificant crappy csv parser.
var headings = recipients.shift();

// Organize recipients into objects with proper headings.
var info = [];
for (var i = 0, ii = recipients.length; i < ii; i += 1) {
  info[i] = {};
  for (var j = 0, jj = headings.length; j < jj; j += 1) {
    info[i][headings[j]] = recipients[i][j];
  }
}
//console.log(info);

// User input again. TODO: possibly error check as well but also meh.
var messageTemplate = handlebars.compile(fs.readFileSync(argv.file, {encoding: 'utf-8'}));
var from = argv.name ? argv.name + ' <' + argv.email + '>' : '<' + argv.email + '>';

var smtpTransport = nodemailer.createTransport('SMTP', {
  service: 'Gmail',
  auth: {
    user: argv.email,
    pass: argv.password,
  }
});

var pending = 0;
for (var i = 0, ii = info.length; i < ii; i += 1) {
  var rec = info[i];
  if (!rec.email) {
    continue;
  }
  pending += 1;
  rec.me = argv.name.split(' ').shift();
  (function(email) {
    smtpTransport.sendMail({
      from: from,
      subject: argv.subject,
      to: rec.email,
      text: messageTemplate(rec)
    }, function(error, response) {
      if (error) {
        console.log(error);
      } else {
        console.log('Successfully sent email to ' + email);
      }
      pending -= 1;
      if (pending === 0) {
        process.exit();
      }
    });
  })(rec.email)
}
