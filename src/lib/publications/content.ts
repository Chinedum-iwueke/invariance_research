import type { PublicationRecord } from "@/lib/publications/model";

export type PublicationFigureBlock = {
  type: "figure";
  label?: string;
  title: string;
  media: string;
  note?: string;
};

export type PublicationCalloutBlock = {
  type: "callout";
  text: string;
};

export type PublicationArticleParagraphBlock = {
  type: "paragraph";
  text: string;
};

export type PublicationArticleBlock = PublicationArticleParagraphBlock | PublicationFigureBlock | PublicationCalloutBlock;

export type PublicationArticleSection = {
  id: string;
  title: string;
  level?: 2 | 3;
  blocks: PublicationArticleBlock[];
};

export type PublicationArticleContent = {
  sections: PublicationArticleSection[];
};

function paragraphs(texts: string[]): PublicationArticleParagraphBlock[] {
  return texts.map((text) => ({ type: "paragraph", text }));
}

const publicationContentBySlug: Record<string, PublicationArticleContent> = {
  "strategy-validation-standards": {
    sections: [
      {
        id: "framework-overview",
        title: "Framework Overview and Governance",
        blocks: paragraphs([
          "Research Standards for Execution-Aware Trading Strategy Validation. Version 1.0. Effective date: 2026-03-05. Prepared for institutional quantitative research and independent validation contexts.",
          "Most trading strategies are improperly validated because the validation process is dominated by in-sample optimisation on historical prices while omitting the statistical consequences of repeated trial-and-error strategy searching, realistic execution and transaction costs, and the operational and microstructural conditions under which trades must actually be placed and filled. The result is a systematic tendency toward performance inflation: backtests that appear strong on paper but degrade materially when deployed.",
          "Naive backtesting is dangerous for two structurally distinct reasons. First, it can produce false discoveries through multiple testing, selection bias, and non-IID dependence structures common in financial data. Second, even if a signal is genuine, realised performance depends critically on microstructure frictions: bid-ask spread, adverse selection, latency, market impact, venue rules, and whether paper trades can be converted into implementable trades with acceptable slippage and capacity.",
          "Execution-aware validation is the disciplined process of assessing a strategy's edge net of realistic trading frictions, constraints, and statistically controlled research degrees of freedom. It treats execution as a model component, not a post-processing haircut. The objective is not to prove performance; it is to estimate a strategy's distribution of outcomes under implementable trading, quantify uncertainty and fragility, and document limitations in a way that supports independent review.",
          "Structured research standards are necessary because strategy research is unusually exposed to hidden researcher degrees of freedom: parameter tuning, data selection, filtering choices, relabelling, and regime selection. It is also unusually sensitive to small modelling choices such as bar execution assumptions, fill rules, cost models, and timestamp conventions. Without explicit standards, research results are difficult to reproduce, compare, or govern.",
        ]),
      },
      {
        id: "purpose-and-scope",
        title: "Purpose and Scope",
        blocks: paragraphs([
          "This framework specifies minimum research standards for execution-aware validation of systematic trading strategies in institutional contexts. It is designed for independent quantitative research consultancies, risk teams validating internal strategies, allocators and due diligence teams reviewing third-party systematic strategies, and researchers who must produce auditable, reproducible evidence of strategy behaviour.",
          "The framework applies, in principle, to strategies that generate discrete trade instructions or continuous target positions, including directional time-series strategies, relative-value and statistical arbitrage strategies, event-driven systematic strategies, intraday strategies sensitive to spreads and market impact, and multi-asset allocation strategies where turnover and costs are material.",
          "The framework does not provide investment advice, signal generation recommendations, or alpha ideas. It does not prescribe asset-class-specific regulation, portfolio management mandates, investor suitability, or discretionary trading judgement. It does not replace legal compliance, operational risk review, cybersecurity review, or production engineering standards, though it interfaces with each.",
          "Independent strategy validation is treated as a second line of research defence. The validator's role is to challenge assumptions, quantify uncertainty, and test robustness using controlled protocols. The validator should be organisationally independent of the strategy's economic owner and should operate under an explicit confidentiality and non-deployment policy to avoid conflicts of interest.",
        ]),
      },
      {
        id: "core-principles",
        title: "Core Principles of Quantitative Strategy Validation",
        blocks: paragraphs([
          "The principles below are normative requirements. Within this document, shall indicates a mandatory standard, should indicates a recommended standard, and may indicates an optional enhancement.",
          "Determinism: A validation study shall be structured so that results are deterministic given the dataset version, execution model specification, parameter set, and code commit. Non-deterministic backtests are not falsifiable and cannot support model risk governance.",
          "Reproducibility: The study shall provide sufficient information for a qualified third party to reproduce results using the same data and computational environment, except where constrained by non-public data policies.",
          "Execution realism: The backtest shall model trades as orders that interact with market microstructure: spread, liquidity, fill uncertainty, and impact. It shall not treat returns as frictionless midpoint price changes.",
          "Risk normalisation: Strategy comparisons shall be performed on risk-normalised units and not solely on nominal returns. Equalisation of risk exposure is necessary to prevent spurious ranking driven by leverage or volatility regime.",
          "Transparency and auditability: The validator shall disclose assumptions that materially affect results, including data filters, time conventions, cost model, order fill logic, parameter search space, and benchmark definitions.",
          "Robustness over optimisation: The research process shall prioritise robustness and stability testing over maximisation of in-sample performance. Research flows must control for multiple testing and selection bias.",
        ]),
      },
      {
        id: "data-integrity",
        title: "Data Integrity Standards",
        blocks: paragraphs([
          "Data integrity is a first-order determinant of backtest credibility because all subsequent inference is conditional on correct timestamps, correct corporate actions where relevant, and correct survival states. Data errors can change the implied trading protocol and turn a realistic trading simulation into an artefact.",
          "Financial datasets also carry structural biases. Survivorship bias can materially inflate estimated performance when disappearing funds, delisted instruments, or failed entities are excluded.",
          "Missing data and gaps shall be explicitly detected and classified as market holiday, venue outage, vendor gap, or filtering artefact. Any imputation shall be reported, justified, and sensitivity-tested.",
          "Duplicate timestamps and ordering shall be detected and resolved using a documented rule, such as exchange sequence numbers where available or deterministic tie-breaking otherwise.",
          "The dataset shall be survivorship-bias-aware where such bias is relevant. If survivorship-free data are not available, the validator shall quantify potential bias directionally and impose conservative interpretation.",
          "The validator shall enforce availability constraints: fundamentals as-of release date rather than statement period end, corporate actions as-of effective time, and index constituents as-of announced membership.",
          "All timestamps shall be normalised to an unambiguous standard, recommended as ISO 8601 with explicit UTC offset, with an explicit trading session calendar. Session segmentation shall reflect the venue and instrument, including cash sessions, overnight sessions, auctions, and market halts where relevant.",
          "Recommended data controls include a coverage audit, timestamp audit, corporate action audit, integrity audit, bias audit, and provenance audit. Each control should state its objective, procedure, and typical failure mode.",
        ]),
      },
      {
        id: "strategy-definition",
        title: "Strategy Definition Standards",
        blocks: paragraphs([
          "A trading strategy cannot be validated unless it is defined as an executable mapping from an information set to orders and positions. Ambiguity creates hidden degrees of freedom: if signals are not defined as orders with price, timing, and conditions, the same signal can imply multiple distinct implementations with materially different outcomes.",
          "A strategy specification submitted for validation shall include market and instrument definitions, entry rules, exit rules, stop logic, position sizing and risk budgeting, session filters, and instrument filters. Each component shall be parameterised and represented in a strategy specification sheet.",
          "Market and instrument definition shall include instruments and contract specifications such as tick size, multiplier, lot size, trading calendar, currency conventions, and funding assumptions where relevant.",
          "Entry rules shall include signal definition and feature set, precise observation timestamps, order type, time-in-force, and handling of partial fills and missed fills.",
          "Exit rules shall include profit-taking logic, time-based exits, structural exit conditions, and explicit mapping from exit signal to executable order.",
          "Stop logic shall specify stop type, the market data used to trigger stops, and intrabar assumptions used to determine whether a stop would have triggered.",
          "Position sizing shall specify the sizing function and constraints, including max leverage, max concentration, max turnover, and min trade size. Session and instrument filters shall specify time-of-day exclusions, event filters, market state filters, eligibility rules, and corporate action rules.",
          "The validator should apply an ambiguity audit: order equivalence testing, temporal availability testing, and stateful dependency testing for warm-up windows, recursive indicators, rolling computations, and burn-in effects.",
        ]),
      },
      {
        id: "execution-modelling",
        title: "Execution Modeling Standards",
        blocks: [
          ...paragraphs([
            "Execution modelling is mandatory because returns are realised through trades executed in a microstructure environment with spreads, liquidity constraints, and informational frictions. Fill assumptions are not an implementation detail; they are a core feature of the model.",
            "At minimum, execution-aware validation shall include bid-ask spread, slippage, market impact, fees, and rebates, each tied to explicit assumptions.",
            "The model shall account for paying the spread when crossing the market. It shall include slippage beyond the quoted spread, reflecting order placement, queue position, latency, and fast price moves. It shall treat market impact as an increasing function of participation rate and trade size relative to liquidity.",
            "Fees, commissions, clearing fees, and maker/taker rebates shall be modelled where applicable. Venue rules and queue priority materially affect execution outcomes and should be represented at least at an aggregate level if strategy sensitivity is plausible.",
          ]),
          {
            type: "callout",
            text: "Implementation Shortfall approximately equals Delay Cost plus Spread Cost plus Impact Cost plus Fees plus Opportunity Cost.",
          },
          ...paragraphs([
            "The validator should express transaction costs using implementation shortfall: the difference between the return of a hypothetical paper portfolio at the decision price and the return of the realised portfolio at achieved execution prices.",
            "Acceptable modelling approaches include fixed spread models for low-frequency strategies, volatility-based slippage models when only bar data exist, and formal impact models for scalable strategies.",
            "When only OHLC bars are available, the validator shall explicitly define intrabar path assumptions because stop and limit execution depends on whether relevant levels were crossed and in what order. A minimum standard is to run optimistic and pessimistic intrabar path scenarios and report a sensitivity band for core metrics.",
          ]),
        ],
      },
      {
        id: "risk-normalization",
        title: "Risk Normalization Standards",
        blocks: paragraphs([
          "Nominal returns are not a sufficient basis for comparison because they confound edge with risk exposure and leverage. Validation reports shall include risk-normalisation lenses that make strategies comparable across instruments, regimes, and capital levels.",
          "Per-trade risk budgeting defines an initial risk unit, such as stop distance times position size, and expresses trade outcomes in units of that risk. This normalises results across instruments and price levels and supports trade-level distribution diagnostics.",
          "Volatility scaling adjusts position size so ex ante volatility contribution is approximately constant. Exposure scaling can materially affect risk-adjusted performance and therefore should be explicit rather than implicit.",
          "Drawdown-aware risk measures recognise that drawdown is a path-dependent risk dimension not captured by variance alone.",
          "The validator should report results in both risk units and capital units. Risk units show return per unit risk; capital units show returns and drawdowns in currency terms for representative capital levels, including capacity limits induced by market impact.",
        ]),
      },
      {
        id: "performance-diagnostics",
        title: "Measurement and Diagnostics Standards",
        blocks: paragraphs([
          "A validation report shall present, at minimum, core metrics computed both gross and net of execution costs: CAGR, maximum drawdown, Sharpe ratio, Sortino ratio, profit factor, expectancy, win rate, and average trade outcome in risk units where used.",
          "Definitions shall be explicit. For example, Sharpe ratio shall state return frequency and risk-free convention. Because performance statistics are estimated quantities, the validator shall qualify them with uncertainty intervals where feasible, sensitivity to sampling frequency and serial correlation, and adjustment for multiple testing when performance arises from a selection process.",
          "Each metric shall be accompanied by an interpretation note because metrics can be gamed or misread. Sharpe can be inflated through serial correlation, non-normal returns, or engineered payoff shapes. Profit factor can be distorted by a small number of extreme wins and is not a risk measure. Maximum drawdown is sample-path dependent and unstable across regimes.",
          "Equity curves are insufficient because they compress trade-level information and can hide structural weaknesses. Microstructure frictions and execution rules operate at the trade and order level, not only at the aggregated equity curve level.",
          "Required trade-level diagnostics include MAE and MFE, trade duration distributions segmented by winners and losers, per-trade outcome distributions in normalised units, and win/loss streak distributions. These diagnostics answer whether exits truncate profitable trades, stops are too tight, edge depends on many small gains or few large gains, and whether loss clustering increases ruin risk.",
        ]),
      },
      {
        id: "robustness-regimes",
        title: "Robustness, Regimes, and Stability Testing",
        blocks: paragraphs([
          "Backtest overfitting is not an occasional mistake; it is an expected outcome when researchers search over many configurations and then report the best result without correcting for the selection process. Standard hold-out approaches are often unreliable in finance because time dependence, non-stationarity, and multiplicity of trials undermine classic regression-style assumptions.",
          "A validator shall perform and report parameter sweeps and stability heatmaps, walk-forward analysis and out-of-sample testing, combinatorial cross-validation or multiple scenario testing where feasible, probability of backtest overfitting estimation when the strategy is selected from many candidates, and deflated-Sharpe or selection-bias-aware testing.",
          "For event-labelled or overlapping-horizon datasets, the validator should apply purging and embargoing logic to avoid leakage between train and test sets.",
          "Strategies often exhibit regime dependency because volatility, liquidity, and market structure change materially over time. Stable strategy behaviour cannot be assumed from a single aggregated sample.",
          "A validation report shall evaluate performance and risk under volatility regimes, market state such as trend versus range, time-of-day and session segments for intraday strategies, and major market phases such as risk-off shocks, crisis periods, and policy regimes where relevant.",
          "Because execution costs are model-dependent, the validator shall perform sensitivity analysis on spread assumptions, slippage and impact coefficients, passive-order fill probability, and latency assumptions where relevant.",
        ]),
      },
      {
        id: "benchmarking-survivability",
        title: "Benchmarking and Survivability",
        blocks: paragraphs([
          "Benchmarking is required because absolute returns are not interpretable without context. A strategy must be compared to implementable alternatives, including those with similar turnover and risk exposures, to determine whether the apparent edge is incremental.",
          "A validation report shall include a relevant passive benchmark, a random-entry baseline where exits or trade management are the claimed edge, and a simple transparent heuristic baseline using the same execution assumptions and cost model.",
          "All benchmarks shall use the same data calendar and timestamp conventions, the same execution cost and slippage assumptions where comparable, and the same periods and regime segmentations.",
          "Survivability is distinct from profitability. A strategy can have positive expected return and still be operationally non-viable due to drawdown risk, tail losses, and adverse streaks.",
          "Required analyses include risk-of-ruin or depletion probability, drawdown probability and expected drawdown, and consecutive-loss modelling. A minimum Monte Carlo protocol should use trade-level outcomes in risk-normalised units, preserve dependence where relevant, simulate capital evolution under position sizing and drawdown limits, and report terminal wealth, maximum drawdown, time-under-water, and breach probabilities.",
        ]),
      },
      {
        id: "reporting-governance",
        title: "Reporting, Confidentiality, and Limitations",
        blocks: paragraphs([
          "Each validation shall produce a controlled research artefact bundle consisting of strategy codification, data versioning, parameter documentation, configuration snapshots, and methodology disclosure.",
          "A published validation report should include objective and scope statement, data provenance and integrity results, strategy specification sheet, execution model specification, performance summary gross and net, trade-level diagnostics, robustness and regime results, benchmark comparisons, survivability and risk-of-ruin analysis, limitations and model risk statement, and reproducibility appendix.",
          "Validators shall treat client strategies, datasets, and implementation details as confidential, including strategy logic, parameter ranges, portfolio weights, broker and venue identifiers, and execution logic.",
          "An independent validator shall adopt a written non-deployment policy specifying that the validator will not trade or advise trading the client strategy, will not reuse client-specific strategy IP, and will disclose potential conflicts.",
          "The validator shall implement data protection controls appropriate to sensitivity, including restricted access, encryption at rest, and audit logs, especially when using non-public transaction or order data.",
          "Backtesting is essential but limited. Professional validation reports shall explicitly state structural market change risk, model risk and cost model misspecification, data errors and bias risk, regime shifts and non-stationarity, and residual research degrees of freedom.",
          "The appropriate posture is methodological humility: validation can reduce uncertainty and identify fragilities, but it cannot eliminate deployment risk.",
        ]),
      },
      {
        id: "glossary",
        title: "Glossary",
        blocks: paragraphs([
          "Backtest: a historical simulation of a strategy's decisions and resulting trades over past data, under explicit assumptions about information availability and execution.",
          "Bid-ask spread: the difference between quoted ask and bid prices; in microstructure theory it reflects adverse selection and information asymmetry and creates a divergence between observed midprice returns and tradable returns.",
          "Combinatorial purged cross-validation: a cross-validation method for time-ordered data that generates many train/test splits without shuffling, using purging and embargoing to avoid leakage and produce a distribution of out-of-sample results.",
          "Deflated Sharpe ratio: a selection-bias-aware Sharpe ratio inference method that adjusts significance thresholds for multiple testing and non-normality.",
          "Execution algorithm: an automated trading program designed to execute a predefined amount under specified parameters while optimising execution outcomes.",
          "Implementation shortfall: the difference in value or return between a theoretical portfolio at decision prices and the realised implemented portfolio at execution prices.",
          "Look-ahead bias: using information that was unknown or unavailable at the time the backtest claims to make a decision.",
          "Market impact: the price movement attributable to one's own trading, often decomposed into temporary and permanent components.",
          "Maximum adverse excursion: the largest unrealised loss experienced during a trade. Maximum favourable excursion: the largest unrealised gain experienced during a trade.",
          "Probability of backtest overfitting: the probability that the strategy selected as best in-sample underperforms the median out-of-sample among candidates under a defined selection process.",
          "Purging and embargoing: procedures in time-series cross-validation that remove training observations overlapping test label horizons and exclude a buffer after the test set to reduce leakage.",
          "Reproducibility: the ability for results to be recreated given the same data, code, and computational environment, subject to permissible access constraints.",
        ]),
      },
      {
        id: "references",
        title: "References",
        blocks: paragraphs([
          "American Statistical Association. Ethical Guidelines for Statistical Practice. Magdon-Ismail, Atiya, Pratap, and Abu-Mostafa. On the maximum drawdown of a Brownian motion. Almgren and Chriss. Optimal execution of portfolio transactions. Bank for International Settlements. FX execution algorithms and market functioning.",
          "Bailey, Borwein, Lopez de Prado, and Zhu. Pseudo-mathematics and financial charlatanism; The probability of backtest overfitting. Bailey and Lopez de Prado. The deflated Sharpe ratio. Bertsimas and Lo. Optimal control of execution costs. Bouchaud, Farmer, and Lillo. How markets slowly digest changes in supply and demand.",
          "Chekhlov, Uryasev, and Zabarankin. Drawdown measure in portfolio optimization. Chan. Quantitative Trading. Elton, Gruber, and Blake. Survivor bias and mutual fund performance. Gatheral. No-dynamic-arbitrage and market impact. Glosten and Milgrom. Bid, ask and transaction prices in a specialist market.",
          "Hansen. A test for superior predictive ability. Hendershott and coauthors. Implementation shortfall with transitory price effects. ISO 8601 date and time format. Katz and McCormick. The Encyclopedia of Trading Strategies. Kelly. A new interpretation of information rate.",
          "Kissell. The Science of Algorithmic Trading and Portfolio Management. Lo. The statistics of Sharpe ratios. Madhavan. Market microstructure: a survey. Moreira and Muir. Volatility-managed portfolios. National Academies of Sciences, Engineering, and Medicine. Reproducibility and Replicability in Science.",
          "Perold. The implementation shortfall: paper versus reality. Roll. A simple implicit measure of the effective bid-ask spread in an efficient market. Sullivan, Timmermann, and White. Data-snooping, technical trading rule performance, and the bootstrap. Vince. The Mathematics of Money Management.",
        ]),
      },
    ],
  },
};

function fallbackContent(publication: PublicationRecord): PublicationArticleContent {
  return {
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [{ type: "paragraph", text: publication.summary }],
      },
    ],
  };
}

export function resolvePublicationContent(publication: PublicationRecord) {
  return publicationContentBySlug[publication.slug] ?? fallbackContent(publication);
}
