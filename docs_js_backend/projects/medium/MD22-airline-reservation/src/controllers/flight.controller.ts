import { Request, Response, NextFunction } from 'express';
import { FlightService } from '../services/flight.service.js';
import { AppError } from '../middleware/error.middleware.js';

export class FlightController {
  private flightService = new FlightService();

  searchFlights = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { origin, destination, date } = req.query;

      if (!origin || !destination || !date) {
        throw new AppError(400, 'Origin, destination, and date are required', 'MISSING_PARAMS');
      }

      const flights = await this.flightService.searchFlights(
        origin as string,
        destination as string,
        new Date(date as string)
      );

      res.json({ data: flights });
    } catch (error) {
      next(error);
    }
  };

  getSeatMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const seatMap = await this.flightService.getSeatMap(id);
      res.json({ data: seatMap });
    } catch (error) {
      next(error);
    }
  };

  getFlightStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const status = await this.flightService.getFlightStatus(id);
      res.json({ data: status });
    } catch (error) {
      next(error);
    }
  };
}
