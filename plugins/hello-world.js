export default function(agent) {
  agent.log('info', '👋 Hello from plugin! Agent level:', agent.state.level);
  // Add a custom method
  agent.sayHello = function() {
    this.log('info', 'Hello, world! From agent', this.id);
  };
}
