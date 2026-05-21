const TERMS = {
  movie: {
    episodeLabel: '部',
    seasonLabel: '',
    episodeCode: (s, e) => `第${e}部`,
    plural: '部',
    addLabel: '添加部数',
    seasonPlaceholder: '',
    episodePlaceholder: '如有多部续集，请设置部数',
  },
  tv: {
    episodeLabel: '集',
    seasonLabel: '季',
    episodeCode: (s, e) => `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`,
    plural: '集',
    addLabel: '每季集数',
    seasonPlaceholder: '季数',
    episodePlaceholder: '每季集数',
  },
  animation: {
    episodeLabel: '集',
    seasonLabel: '季',
    episodeCode: (s, e) => `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`,
    plural: '集',
    addLabel: '每季集数',
    seasonPlaceholder: '季数',
    episodePlaceholder: '每季集数',
  },
  book: {
    episodeLabel: '章',
    seasonLabel: '卷',
    episodeCode: (s, e) => `卷${s}·第${e}章`,
    plural: '章',
    addLabel: '每卷章数',
    seasonPlaceholder: '卷数',
    episodePlaceholder: '每卷章数',
  },
  game: {
    episodeLabel: '章',
    seasonLabel: '作',
    episodeCode: (s, e) => `第${s}作·第${e}章`,
    plural: '章',
    addLabel: '每作章数',
    seasonPlaceholder: '作品序号',
    episodePlaceholder: '每作章数',
  },
}

export function getTerminology(category) {
  return TERMS[category] || TERMS.tv
}

export function episodeLabel(ep, category) {
  const t = getTerminology(category)
  return t.episodeCode(ep.season, ep.episode)
}

export function progressLabel(show) {
  const t = getTerminology(show.category)
  return `${show.ratedCount || 0} / ${show.totalEpisodes || 0} ${t.plural}`
}
