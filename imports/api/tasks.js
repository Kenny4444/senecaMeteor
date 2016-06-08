import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import Seneca from 'seneca';
//const seneca = require('seneca')().client();
const senecaAction = Meteor.wrapAsync(Seneca.act, Seneca);

export const Tasks = new Mongo.Collection('tasks');

if (Meteor.isServer) {
  // This code only runs on the server
  // Only publish tasks that are public or belong to the current user
  Meteor.publish('tasks', function () {
    seneca.act({role: 'tasks',cmd:'list'}, (error,tasks) => {
      const socket = io('http://localhost:3002');

      //Send initial set of Records
      tasks.forEach(task => this.added('tasks', tasks.id, task));

      socket.on('created', (id, fields) => this.added('tasks', id,fields));
      socket.on('updated', (id, fields) => this.changed('tasks', id,fields));
      socket.on('removed', id => this.removed('tasks', id));

      this.onStop(() => {
        socket.disconnect();
      });
      this.ready();
    })
  });
}

Meteor.methods({
  'tasks.insert'(text) {
    return senecaAction({role:'tasks', cmd: 'create',text});
  },
  'tasks.remove'(id) {
    return senecaAction({role:'tasks',cmd:'remove',id});
  },
  'tasks.setChecked'(id, setChecked) {
    return senecaAction({role:'tasks',cmd:'check',id,setChecked});
  },
  'tasks.setPrivate'(taskId, setToPrivate) {
    check(taskId, String);
    check(setToPrivate, Boolean);

    const task = Tasks.findOne(taskId);

    // Make sure only the task owner can make a task private
    if (task.owner !== this.userId) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.update(taskId, { $set: { private: setToPrivate } });
  },
});
