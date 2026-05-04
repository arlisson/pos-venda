module.exports = {
  index: async (req, res) => res.status(404).json({ message: 'Planos removidos' }),
  store: async (req, res) => res.status(404).json({ message: 'Planos removidos' }),
  update: async (req, res) => res.status(404).json({ message: 'Planos removidos' }),
  destroy: async (req, res) => res.status(404).json({ message: 'Planos removidos' })
};
